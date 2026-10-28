
const express = require("express");
const mongoose = require("mongoose");
const Todo = require("../models/Todo");

const router = express.Router();

const { redisClient } = require("../config/redis");

const CACHE_KEY = "todos:all";
const CACHE_TTL = 30; // Cache time-to-live in seconds

async function invalidateTodosCache() {
  try {
    await redisClient.del(CACHE_KEY);
    console.log("Todos cache invalidated");
  } catch (error) {
    console.error("Error invalidating todos cache:", error);
  }
}

// GET all todos
router.get("/", async (req, res) => {
  try {
    try {
      // 1. Check if todos are cached in Redis
      const cachedTodos = await redisClient.get(CACHE_KEY);

      if (cachedTodos) {
        console.log("Serving todos from Redis cache");
        return res.status(200).json(JSON.parse(cachedTodos));
      }
    } catch (error) {
      console.error("Redis error:", error);
    }

    console.log("Fetching todos from MongoDB");
    const todos = await Todo.find().sort({ createdAt: -1 });

    // Store the fetched todos in Redis cache
    try {
      await redisClient.setEx(
        CACHE_KEY,
        CACHE_TTL,
        JSON.stringify(todos)
      );
    } catch (error) {
      console.error("Redis error:", error);
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

    const todo = await Todo.findById(id);

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

    await invalidateTodosCache();

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
    const todo = await Todo.create({
      title: req.body.title,
    });

    await invalidateTodosCache();

    res.status(201).json(todo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT - Update a todo by ID
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid todo ID",
      });
    }

    if (title === undefined || completed === undefined) {
      return res.status(400).json({
        error: "Both title and completed are required",
      });
    }

    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      { title, completed },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTodo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }

    await invalidateTodosCache();

    res.status(200).json(updatedTodo);
  } catch (error) {
    res.status(400).json({ error: error.message });
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

    const updatedTodo = await Todo.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTodo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }
    await invalidateTodosCache();

    res.status(200).json(updatedTodo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE all todos
router.delete("/", async (req, res) => {
  try {
    const result = await Todo.deleteMany({});

    await invalidateTodosCache();

    res.status(200).json({
      message: "All todos deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const todo = await Todo.findByIdAndDelete(id);

    if (!todo) {
      return res.status(404).json({
        error: "Todo not found",
      });
    }

    await invalidateTodosCache();

    res.status(200).json({
      message: "Todo deleted successfully",
      deletedTodo: todo,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
