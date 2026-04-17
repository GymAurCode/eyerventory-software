import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api";

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
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/health`, {
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
