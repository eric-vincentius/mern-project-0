
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

async function handleResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || data.error || "Request failed"
    );
  }

  return data;
}

export const authService = {
  // REGISTER
  async register(name, email, password) {
    const response = await fetch(
      `${API_URL}/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    );

    return handleResponse(response);
  },

  // LOGIN
  async login(email, password) {
    const response = await fetch(
      `${API_URL}/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    return handleResponse(response);
  },

  // GET CURRENT AUTHENTICATED USER
  async getMe(token) {
    const response = await fetch(
      `${API_URL}/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return handleResponse(response);
  },
};
