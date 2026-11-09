
const express = require("express");
const mongoose = require("mongoose");
const Todo = require("../models/Todo");


const router = express.Router();

const requireAuth = require("../middleware/requireAuth");

router.use(requireAuth);

// TODO: Import the Redis client from the redis.js file
const { connectRedis, redisClient } = require("../config/redis");

const getTodosCacheKey = (userId) => `todos:user:${userId.toString()}`;

const CACHE_TTL = 30; // Cache time-to-live in seconds

// TODO: Create a function to invalidate the todos cache in Redis
async function invalidateTodosCache(userId) {
  const cacheKey = getTodosCacheKey(userId)
  try {
    if (!redisClient.isReady) {
      return;
    }

    await redisClient.del(cacheKey);
    console.log("[Cache] Invalidated todos:all");
  } catch (error) {
    console.error("[Cache] Invalidation failed: ", error.message);
  }
}

// GET all todos
router.get("/", async (req, res) => {
  const cacheKey = getTodosCacheKey(req.user._id);
  try {
    try {
      // TODO: 1. Check if todos are cached in Redis
      const cachedTodos = await redisClient.get(cacheKey);
      // TODO: 2. If cached, return the cached todos
      if (cachedTodos) {
        console.log("[Cache] HIT:todos:all");
        return res.status(200).json(JSON.parse(cachedTodos));
      }
    } catch (error) {
      console.error("Redis error:", error);
    }

    // If not cached, fetch todos from MongoDB
    console.log("Fetching todos from MongoDB");
    const todos = await Todo.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    // TODO: Store the fetched todos in Redis cache
    try {
      await redisClient.set(
        cacheKey,
        JSON.stringify(todos),
        { EX: CACHE_TTL }
      );

      console.log("[Cache] Stored todos:all for 30 seconds")
    } catch (cacheError) {
      console.warn("[Cache] Write failed: ", cacheError.message);
      // Still return the MongoDB result
    }

    return res.status(200).json(todos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/todos/export
 * Export all todos as a JSON file
 */
router.get("/export", async (req, res) => {
  try {
    const todos = await Todo.find()
      .sort({ createdAt: -1 })
      .lean();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      totalRecords: todos.length,
      todos: todos.map((todo) => ({
        _id: todo._id,
        title: todo.title,
        completed: todo.completed,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      })),
    };

    const filename = `todos-${Date.now()}.json`;

    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.status(200).send(
      JSON.stringify(exportData, null, 2)
    );
  } catch (error) {
    console.error("Export error:", error);

    res.status(500).json({
      error: "Failed to export todos",
    });
  }
});

// GET a todo by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid todo ID",
      });
    }

    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }

    res.status(200).json(todo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// POST /api/todos/import
router.post("/import", async (req, res) => {
  try {
    const { todos } = req.body;

    if (!Array.isArray(todos)) {
      return res.status(400).json({
        error: "Invalid format: todos must be an array",
      });
    }

    if (todos.length > 1000) {
      return res.status(400).json({
        error: "Maximum 1000 todos per import",
      });
    }

    const seenIds = new Set();
    const operations = [];

    for (const todo of todos) {
      if (
        !todo ||
        typeof todo !== "object" ||
        Array.isArray(todo) ||
        typeof todo.title !== "string" ||
        !todo.title.trim() ||
        typeof todo.completed !== "boolean"
      ) {
        return res.status(400).json({
          error: "Invalid todo data",
        });
      }

      if (todo._id !== undefined) {
        if (!mongoose.isValidObjectId(todo._id)) {
          return res.status(400).json({
            error: "Invalid MongoDB ID in import",
          });
        }

        const id = String(todo._id).toLowerCase();

        if (seenIds.has(id)) {
          return res.status(400).json({
            error: "Duplicate todo ID in import file",
          });
        }

        seenIds.add(id);

        operations.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(id) },
            update: {
              $set: {
                title: todo.title.trim(),
                completed: todo.completed,
              },
            },
            upsert: true,
          },
        });
      } else {
        operations.push({
          insertOne: {
            document: {
              title: todo.title.trim(),
              completed: todo.completed,
            },
          },
        });
      }
    }

    if (operations.length === 0) {
      return res.status(200).json({
        message: "No todos to import",
        importedCount: 0,
      });
    }

    const result = await Todo.bulkWrite(operations);

    await invalidateTodosCache(req.user._id);

    res.status(200).json({
      message: "Import completed successfully",
      importedCount: result.upsertedCount + result.insertedCount,
      updatedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    });
  } catch (error) {
    console.error("Import error:", error);

    res.status(500).json({
      error: "Failed to import todos",
    });
  }
});

// POST a new todo
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Title must contain 1 to 100 characters",
      });
    }

    const todo = await Todo.create({
      title: title.trim(),
      completed: false,
      user: req.user._id,
    });

    await invalidateTodosCache(req.user._id);

    return res.status(201).json(todo);
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    });
  }
});


// PUT - Update a todo by ID

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    console.log("PUT request body:", req.body);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid Todo ID",
      });
    }

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Invalid Todo title",
      });
    }

    if (
      completed !== undefined &&
      typeof completed !== "boolean"
    ) {
      return res.status(400).json({
        message: "Completed must be a boolean",
      });
    }

    // Find the Todo belonging to the logged-in user
    const todo = await Todo.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    console.log("Before update:", {
      title: todo.title,
      completed: todo.completed,
    });

    // Update the fields
    todo.title = title.trim();

    if (completed !== undefined) {
      todo.completed = completed;
    }

    // Save the updated document
    await todo.save();

    console.log("After update:", {
      title: todo.title,
      completed: todo.completed,
    });

    // Invalidate the user's Redis cache
    await invalidateTodosCache(req.user._id);

    return res.status(200).json(todo);

  } catch (error) {
    console.error("PUT Todo error:", error);

    return res.status(500).json({
      message: "Failed to update Todo",
    });
  }
});

// PATCH - Partially update a todo
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid todo ID",
      });
    }

    const updates = {};

    if (title !== undefined) updates.title = title;
    if (completed !== undefined) updates.completed = completed;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No valid fields provided",
      });
    }

    const updatedTodo = await Todo.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id,
    },
    {
      $set: updates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

    if (!updatedTodo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }

    // TODO: Invalidate the todos cache in Redis after updating a todo
    await invalidateTodosCache(req.user._id);

    res.status(200).json(updatedTodo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE all todos
router.delete("/", async (req, res) => {
  try {
    const result = await Todo.deleteMany({
      user: req.user._id,
    });

    await invalidateTodosCache(req.user._id);

    return res.status(200).json({
      message: "All todos deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

// DELETE a todo by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid todo ID",
      });
    }

    const deletedTodo = await Todo.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deletedTodo) {
      return res.status(404).json({
        message: "Todo not found",
      });
    }

    res.json({
      message: "Todo deleted",
    });

    if (!todo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }

    await invalidateTodosCache(req.user._id);

    res.status(200).json({
      message: "Todo deleted successfully",
      deletedTodo: todo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
