import axios from "axios";

// Dynamic port resolution for Electron
let BACKEND_PORT = 8000; // Default fallback

// Function to get backend port (async)
async function getBackendPort() {
  if (typeof window !== "undefined" && window.electron?.getBackendPort) {
    try {
      const port = await window.electron.getBackendPort();
      console.log("[api-client] Using dynamic backend port:", port);
      return port || 8000;
    } catch (err) {
      console.warn("[api-client] Failed to get backend port, using default 8000:", err);
    }
  }
  return 8000;
}

// Initialize port (will be updated on first API call)
getBackendPort().then(port => {
  BACKEND_PORT = port;
  // Update axios base URL
  api.defaults.baseURL = typeof window !== "undefined" && window.location.protocol === "file:"
    ? `http://127.0.0.1:${BACKEND_PORT}/api`
    : `http://${window.location.hostname}:${BACKEND_PORT}/api`;
});

// In Electron the frontend is served from file:// so we always need the full URL.
// In browser dev (Vite), the backend runs on the same machine — use the current
// hostname so localhost:5173 → localhost:8000 (avoids the 127.0.0.1 CORS mismatch).
const BASE_URL = typeof window !== "undefined" && window.location.protocol === "file:"
  ? `http://127.0.0.1:${BACKEND_PORT}/api`
  : `http://${window.location.hostname}:${BACKEND_PORT}/api`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear session and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

export function setToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

/**
 * Polls /api/health until the backend responds.
 * Used by main.jsx before mounting the React app.
 * Uses aggressive polling (100ms) since Electron starts backend before loading frontend.
 */
export async function waitForBackend(maxWaitMs = 10000, intervalMs = 100) {
  // Get the current backend port
  const port = await getBackendPort();

  const healthUrl = typeof window !== "undefined" && window.location.protocol === "file:"
    ? `http://127.0.0.1:${port}/api/health`
    : `http://${window.location.hostname}:${port}/api/health`;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(600),
      });
      if (res.ok) return true;
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return false; // timed out
}

export default api;
