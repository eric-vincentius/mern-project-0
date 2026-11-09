
import { useEffect, useRef, useState } from "react";
import { todoService } from "../services/todoService";
import { useAuth } from "../context/AuthContext";
// TODO: Import the ToastContainer and toast with the CSS from react-toastify
import { toast } from "react-toastify";

function TodoPage() {
  const { user, token, logout } = useAuth();
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // GET all todos
  async function fetchTodos() {
    try {
      setError("");
      const data = await todoService.getAll(token);
      setTodos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos();
  }, [token]);

  // POST new todo
  async function addTodo(e) {
    e.preventDefault();
    if (!title.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      const newTodo = await todoService.create(title.trim(), token);
      setTodos((prev) => [newTodo, ...prev]);
      setTitle("");
      
      // TODO: Show a success toast notification after adding a new todo
      toast.success("Todo added succesfully!");
    } catch (err) {
      setError(err.message);
      // TODO: Show an error toast notification if adding a new todo fails
      toast.error("Failed to add todo.")
    } finally {
      setBusy(false);
    }
  }

  // PATCH completion status
  async function toggleCompleted(todo) {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const updated = await todoService.patch(todo._id, {
        completed: !todo.completed,
      }, token);

      setTodos((prev) =>
        prev.map((t) => t._id === updated._id ? updated : t)
      );

      if (selectedTodo?._id === updated._id) {
        setSelectedTodo(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Start editing
  function startEditing(todo) {
    setEditingId(todo._id);
    setEditTitle(todo.title);
  }

  // PUT update todo
  async function saveEdit(todo) {
    if (!editTitle.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      const updated = await todoService.update(todo._id, {
        title: editTitle.trim(),
        completed: todo.completed,
      }, token);

      setTodos((prev) =>
        prev.map((t) => t._id === updated._id ? updated : t)
      );

      if (selectedTodo?._id === updated._id) {
        setSelectedTodo(updated);
      }

      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // GET todo by ID
  async function viewDetails(id) {
    setError("");

    try {
      const todo = await todoService.getById(id, token);
      setSelectedTodo(todo);
    } catch (err) {
      setError(err.message);
    }
  }

  // DELETE by ID
  async function deleteTodo(id) {
    if (busy) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this todo?"
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await todoService.deleteById(id, token);
      setTodos((prev) => prev.filter((t) => t._id !== id));

      if (selectedTodo?._id === id) {
        setSelectedTodo(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // DELETE all todos
  async function deleteAllTodos() {
    if (busy || todos.length === 0) return;

    const confirmed = window.confirm(
      "Delete ALL todos? This action cannot be undone."
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");

    try {
      await todoService.deleteAll(token);
      setTodos([]);
      setSelectedTodo(null);
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const completedCount = todos.filter(
    (todo) => todo.completed
  ).length;

  const fileInputRef = useRef(null);

  // Export all todos
  async function exportTodos() {
    setBusy(true);
    setError("");

    try {
      await todoService.exportData(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Import todos from a JSON file
  async function importTodos(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setBusy(true);
    setError("");

    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("File must be smaller than 2 MB");
      }

      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.todos)) {
        throw new Error(
          "Invalid JSON format: expected a todos array"
        );
      }

       const result = await todoService.importData(data, token);

        await fetchTodos();

        alert(
        `Import completed!\n` +
        `New: ${result.importedCount}\n` +
        `Updated: ${result.updatedCount}`
        );
        } catch (err) {
        setError(
        err instanceof SyntaxError
        ? "Invalid JSON file"
        : err.message
        );
        } finally {
        setBusy(false);

        if (fileInputRef.current) {
        fileInputRef.current.value = "";
        }
    }
  }


  return (
    <main className="app-container">
      <header className="app-header">
        <h1>MERN Todo Manager</h1>
        <div className="auth-header-actions">
          <span>Welcome, {user?.name || user?.email}</span>
          <button type="button" className="secondary" onClick={logout}>Logout</button>
        </div>
        <p>Manage your tasks with React, Express and MongoDB</p>
      </header>

      <section className="stats">
        <div>Total: {todos.length}</div>
        <div>Completed: {completedCount}</div>
        <div>Pending: {todos.length - completedCount}</div>
      </section>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={addTodo} className="add-form">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          disabled={busy}
          required
        />
        <button type="submit" disabled={busy || !title.trim()}>
          Add Todo
        </button>
      </form>

      
      <div className="list-header">
        <h2>Your Tasks</h2>

        <div className="data-actions">
          <button
            className="secondary"
            onClick={exportTodos}
            disabled={busy}
          >
            Export JSON
          </button>

          <button
            className="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Import JSON
          </button>

          <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={importTodos}
          style={{ display: "none" }}
          />

          <button
          className="danger"
          onClick={deleteAllTodos}
          disabled={busy || todos.length === 0}
          >
          Delete All
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading todos...</p>
      ) : todos.length === 0 ? (
        <p className="empty-message">No todos yet. Add your first task!</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo._id} className="todo-item">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleCompleted(todo)}
                disabled={busy}
              />

              {editingId === todo._id ? (
                <div className="edit-form">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <button
                    onClick={() => saveEdit(todo)}
                    disabled={busy || !editTitle.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className={
                      todo.completed ? "todo-title completed" : "todo-title"
                    }
                  >
                    {todo.title}
                  </span>

                  <div className="todo-actions">
                    <button
                      className="secondary"
                      onClick={() => viewDetails(todo._id)}
                    >
                      View
                    </button>
                    <button
                      className="secondary"
                      onClick={() => startEditing(todo)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteTodo(todo._id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedTodo && (
        <section className="details-panel">
          <div className="list-header">
            <h2>Todo Details</h2>
            <button
              className="secondary"
              onClick={() => setSelectedTodo(null)}
            >
              Close
            </button>
          </div>

          <p><strong>ID:</strong> {selectedTodo._id}</p>
          <p><strong>Title:</strong> {selectedTodo.title}</p>
          <p>
            <strong>Status:</strong>{" "}
            {selectedTodo.completed ? "Completed" : "Pending"}
          </p>
          <p>
            <strong>Created:</strong>{" "}
            {new Date(selectedTodo.createdAt).toLocaleString()}
          </p>
        </section>
      )}

      {/* TODO: Add the ToastContainer component to display toast notifications */}
    </main>
  );
}

export default TodoPage;
