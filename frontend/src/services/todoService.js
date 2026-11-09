const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

async function apiRequest(path, token, options = {}) {
  if (!token) {
    throw new Error("Please log in first");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Request failed"
    );
  }

  return data;
}

function jsonOptions(method, data) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

export const todoService = {
  getAll(token) {
    return apiRequest("/todos", token);
  },

  getById(id, token) {
    return apiRequest(`/todos/${id}`, token);
  },

  create(title, token) {
    return apiRequest(
      "/todos",
      token,
      jsonOptions("POST", { title })
    );
  },

  update(id, updates, token) {
    return apiRequest(
      `/todos/${id}`,
      token,
      jsonOptions("PUT", updates)
    );
  },

  patch(id, updates, token) {
    return apiRequest(
      `/todos/${id}`,
      token,
      jsonOptions("PATCH", updates)
    );
  },

  deleteById(id, token) {
    return apiRequest(`/todos/${id}`, token, {
      method: "DELETE",
    });
  },

  deleteAll(token) {
    return apiRequest("/todos", token, {
      method: "DELETE",
    });
  },

  importData(data, token) {
    return apiRequest(
      "/todos/import",
      token,
      jsonOptions("POST", data)
    );
  },

  async exportData(token) {
    if (!token) {
      throw new Error("Please log in first");
    }

    const response = await fetch(
      `${API_URL}/todos/export`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to export todos");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `todos-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  },
};