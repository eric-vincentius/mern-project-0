import { useState } from "react";
import { toast } from "react-toastify";
import { authService } from "../services/authService";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ onGoToRegister }) {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const data = await authService.login(
        email.trim(),
        password
      );

      if (!data.token || !data.user) {
        throw new Error("Invalid login response");
      }

      login(data.user, data.token);
      toast.success("Logged in successfully!");
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-container">
      <header className="app-header">
        <h1>MERN Todo Manager</h1>
        <p>Login to manage your tasks</p>
      </header>

      <section className="auth-card">
        <h2>Login</h2>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />

          <label htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p>
          Don't have an account?{" "}
          <button
            type="button"
            className="secondary"
            onClick={onGoToRegister}
          >
            Register
          </button>
        </p>
      </section>
    </main>
  );
}