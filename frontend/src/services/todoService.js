
const API_URL = `${import.meta.env.VITE_API_URL}/api/todos`;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

export const todoService = {
  // GET all todos
  getAll: () => request(API_URL),

  // GET todo by ID
  getById: (id) => request(`${API_URL}/${id}`),

  // POST new todo
  create: (title) =>
    request(API_URL, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  // PUT update todo
  update: (id, todo) =>
    request(`${API_URL}/${id}`, {
      method: "PUT",
      body: JSON.stringify(todo),
    }),

  // PATCH partial update
  patch: (id, changes) =>
    request(`${API_URL}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),

  // DELETE todo by ID
  deleteById: (id) =>
    request(`${API_URL}/${id}`, {
      method: "DELETE",
    }),

  // DELETE all todos
  deleteAll: () =>
    request(API_URL, {
      method: "DELETE",
    }),

  // Export todos to a JSON file
    exportData: async () => {
    const response = await fetch(`${API_URL}/export`);

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

    // Import todos from JSON data
    importData: (data) =>
    request(`${API_URL}/import`, {
        method: "POST",
        body: JSON.stringify(data),
    }),
};
