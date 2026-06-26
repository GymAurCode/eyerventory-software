import axios from "axios";

/**
 * Get backend URL dynamically from Electron or fallback to default
 */
async function getBackendUrl() {
  // In Electron, get the dynamic port from the backend manager
  if (typeof window !== "undefined" && window.desktop?.getBackendInfo) {
    try {
      const info = await window.desktop.getBackendInfo();
      if (info.running && info.url) {
        return `${info.url}/api`;
      }
    } catch (err) {
      console.warn("[api-client] failed to get backend info from Electron:", err);
    }
  }

  // Fallback: In Electron use default, in browser dev use current hostname
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://127.0.0.1:8000/api";
  }
  
  return `http://${window.location.hostname}:8000/api`;
}

// Initialize with default, will be updated dynamically
const BASE_URL = "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Update base URL dynamically on first request
let baseUrlInitialized = false;
api.interceptors.request.use(async (config) => {
  if (!baseUrlInitialized) {
    const dynamicUrl = await getBackendUrl();
    api.defaults.baseURL = dynamicUrl;
    config.baseURL = dynamicUrl;
    baseUrlInitialized = true;
    console.log("[api-client] using backend URL:", dynamicUrl);
  }

  // Attach token on every request
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear session — AuthProvider listens for this event to show LoginPage
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("name");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
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
  let healthUrl;
  
  // Try to get dynamic URL from Electron
  if (typeof window !== "undefined" && window.desktop?.getBackendInfo) {
    try {
      const info = await window.desktop.getBackendInfo();
      if (info.running && info.url) {
        healthUrl = `${info.url}/api/health`;
      }
    } catch (err) {
      console.warn("[api-client] failed to get backend info for health check:", err);
    }
  }
  
  // Fallback to default
  if (!healthUrl) {
    healthUrl = typeof window !== "undefined" && window.location.protocol === "file:"
      ? "http://127.0.0.1:8000/api/health"
      : `http://${window.location.hostname}:8000/api/health`;
  }

  console.log("[api-client] waiting for backend at:", healthUrl);
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(600),
      });
      if (res.ok) {
        console.log("[api-client] backend is ready");
        return true;
      }
    } catch {
      // not ready yet — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  console.error("[api-client] backend health check timed out");
  return false; // timed out
}

export default api;
