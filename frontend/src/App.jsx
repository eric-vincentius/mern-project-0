import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TodoPage from "./pages/TodoPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const { user } = useAuth();
  const [authPage, setAuthPage] = useState("login");

  return (
    <>
      {user ? (
        <TodoPage />
      ) : authPage === "login" ? (
        <LoginPage
          onGoToRegister={() => setAuthPage("register")}
        />
      ) : (
        <RegisterPage
          onGoToLogin={() => setAuthPage("login")}
        />
      )}

      <ToastContainer position="top-right" />
    </>
  );
}

export default App;