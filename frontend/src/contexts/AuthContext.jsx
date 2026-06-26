import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setAuthToken] = useState(localStorage.getItem("token") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [name, setName] = useState(localStorage.getItem("name") || "");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(() => !!localStorage.getItem("token"));

  if (token) setToken(token);

  // Validate stored token on mount — if invalid, clear session and show login
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      setValidating(false);
      return;
    }

    let cancelled = false;
    api.get("/auth/me")
      .then(() => {
        if (!cancelled) setValidating(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("name");
          setAuthToken("");
          setRole("");
          setName("");
          setToken("");
        }
        setValidating(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Listen for 401 events from the API interceptor (session expired mid-use)
  useEffect(() => {
    const handler = () => {
      setAuthToken("");
      setRole("");
      setName("");
      setToken("");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

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

  const value = useMemo(
    () => ({ token, role, name, login, logout, loading, validating }),
    [token, role, name, loading, validating],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
