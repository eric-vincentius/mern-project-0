import { useState } from "react";
import { toast } from "react-toastify";
import { authService } from "../services/authService";

export default function RegisterPage({ onGoToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await authService.register(
        name.trim(),
        email.trim(),
        password
      );

      toast.success(
        "Registration successful! Please log in."
      );

      onGoToLogin();
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
        <p>Create an account to manage your tasks</p>
      </header>

      <section className="auth-card">
        <h2>Register</h2>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <label htmlFor="register-name">Name</label>
          <input
            id="register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            disabled={loading}
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />

          <label htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />

          <label htmlFor="register-confirm">
            Confirm Password
          </label>
          <input
            id="register-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            required
            autoComplete="new-password"
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p>
          Already have an account?{" "}
          <button
            type="button"
            className="secondary"
            onClick={onGoToLogin}
          >
            Login
          </button>
        </p>
      </section>
    </main>
  );
}