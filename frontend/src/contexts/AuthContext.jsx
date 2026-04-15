import { createContext, useContext, useMemo, useState } from "react";
import api, { setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setAuthToken] = useState(localStorage.getItem("token") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [loading, setLoading] = useState(false);

  if (token) setToken(token);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      setAuthToken(data.access_token);
      setRole(data.role);
      setName(data.name);
      setToken(data.access_token);
      return data;
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if (status === 401) throw new Error("Invalid email or password");
      if (status === 422) {
        // FastAPI validation error — detail is an array of objects
        const msg = Array.isArray(detail)
          ? detail.map((e) => e.msg).join(", ")
          : "Invalid request. Check your email and password.";
        throw new Error(msg);
      }
      throw new Error(typeof detail === "string" ? detail : "Backend is unavailable. Please start the API server.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    setAuthToken("");
    setRole("");
    setName("");
    setToken("");
  };

  const value = useMemo(() => ({ token, role, name, login, logout, loading }), [token, role, name, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
