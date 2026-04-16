import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { waitForBackend } from "./api/client";

function ThemeAwareToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      duration={3500}
      toastOptions={{
        style: {
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
        },
      }}
    />
  );
}

function BackendGate({ children }) {
  const [status, setStatus] = useState("waiting"); // "waiting" | "ready" | "failed"
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Animate the loading dots
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);

    waitForBackend(30000, 700).then((ok) => {
      clearInterval(dotInterval);
      setStatus(ok ? "ready" : "failed");
    });

    return () => clearInterval(dotInterval);
  }, []);

  if (status === "ready") return children;

  if (status === "failed") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Backend Unavailable</h2>
          <p style={styles.message}>
            The backend service could not be reached at{" "}
            <code style={styles.code}>http://127.0.0.1:8000</code>.
          </p>
          <p style={styles.hint}>
            Check the application logs for details, then restart the app.
          </p>
          <button
            style={styles.button}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // status === "waiting"
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <h2 style={styles.title}>Starting{dots}</h2>
        <p style={styles.message}>Waiting for backend service to be ready.</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0f172a",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "16px",
    padding: "40px 48px",
    textAlign: "center",
    maxWidth: "420px",
    width: "100%",
  },
  icon: { fontSize: "40px", marginBottom: "16px" },
  title: { color: "#f1f5f9", fontSize: "20px", margin: "0 0 12px" },
  message: { color: "#94a3b8", fontSize: "14px", margin: "0 0 8px", lineHeight: 1.6 },
  hint: { color: "#64748b", fontSize: "13px", margin: "0 0 24px" },
  code: {
    background: "#0f172a",
    color: "#38bdf8",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "13px",
  },
  button: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 28px",
    fontSize: "14px",
    cursor: "pointer",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #334155",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto 20px",
  },
};

// Inject keyframe for spinner (no CSS file dependency)
const styleTag = document.createElement("style");
styleTag.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
document.head.appendChild(styleTag);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeProvider>
        <BackendGate>
          <App />
          <ThemeAwareToaster />
        </BackendGate>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
