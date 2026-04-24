/**
 * LicenseGate — wraps the entire app.
 * Checks local token on mount. If invalid, shows activation screen.
 * If valid, renders children immediately (fully offline).
 */
import { useEffect, useState } from "react";

const S = {
  container: {
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", background: "#0f172a", fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#1e293b", border: "1px solid #334155", borderRadius: "16px",
    padding: "40px 48px", textAlign: "center", maxWidth: "440px", width: "100%",
  },
  logo: { fontSize: "36px", marginBottom: "12px" },
  title: { color: "#f1f5f9", fontSize: "22px", margin: "0 0 6px", fontWeight: 600 },
  subtitle: { color: "#64748b", fontSize: "13px", margin: "0 0 28px" },
  label: { display: "block", textAlign: "left", color: "#94a3b8", fontSize: "13px", marginBottom: "6px" },
  input: {
    width: "100%", padding: "10px 14px", background: "#0f172a", border: "1px solid #334155",
    borderRadius: "8px", color: "#f1f5f9", fontSize: "14px", outline: "none",
    boxSizing: "border-box", letterSpacing: "0.05em",
  },
  btn: {
    width: "100%", marginTop: "16px", padding: "11px", background: "#282950",
    color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px",
    cursor: "pointer", fontWeight: 600,
  },
  btnDisabled: { opacity: 0.6, cursor: "not-allowed" },
  error: { color: "#f87171", fontSize: "13px", marginTop: "10px" },
  success: { color: "#34d399", fontSize: "13px", marginTop: "10px" },
  mid: {
    marginTop: "20px", padding: "8px 12px", background: "#0f172a",
    borderRadius: "6px", fontSize: "11px", color: "#475569",
    wordBreak: "break-all", textAlign: "left",
  },
  expiry: { color: "#94a3b8", fontSize: "12px", marginTop: "8px" },
};

export default function LicenseGate({ children }) {
  const [status, setStatus] = useState("checking"); // checking | valid | invalid
  const [licenseKey, setLicenseKey] = useState("");
  const [machineId, setMachineId] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [expiry, setExpiry] = useState(null);

  useEffect(() => {
    // In browser/dev without Electron, skip license check
    if (!window.licenseAPI) {
      setStatus("valid");
      return;
    }
    window.licenseAPI.check().then((result) => {
      if (result.valid) {
        setExpiry(result.expiry);
        setStatus("valid");
      } else {
        setStatus("invalid");
        window.licenseAPI.getMachineId().then(setMachineId).catch(() => {});
      }
    }).catch(() => setStatus("invalid"));
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError("");
    setSuccessMsg("");
    try {
      const result = await window.licenseAPI.activate(licenseKey.trim());
      if (result.ok) {
        setSuccessMsg("License activated successfully. Loading app...");
        setExpiry(result.expiry);
        setTimeout(() => setStatus("valid"), 1200);
      } else {
        setError(result.error || "Activation failed");
      }
    } catch {
      setError("Unexpected error during activation");
    } finally {
      setActivating(false);
    }
  };

  if (status === "checking") {
    return (
      <div style={S.container}>
        <div style={S.card}>
          <div style={S.logo}>🔐</div>
          <h2 style={S.title}>Verifying License</h2>
          <p style={{ color: "#64748b", fontSize: "13px" }}>Please wait...</p>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div style={S.container}>
        <div style={S.card}>
          <div style={S.logo}>🔑</div>
          <h2 style={S.title}>Activate EyerFlow</h2>
          <p style={S.subtitle}>Enter your license key to continue</p>
          <form onSubmit={handleActivate}>
            <label style={S.label}>License Key</label>
            <input
              style={S.input}
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              autoFocus
            />
            {error && <p style={S.error}>{error}</p>}
            {successMsg && <p style={S.success}>{successMsg}</p>}
            <button
              type="submit"
              style={{ ...S.btn, ...(activating ? S.btnDisabled : {}) }}
              disabled={activating}
            >
              {activating ? "Activating..." : "Activate"}
            </button>
          </form>
          {machineId && (
            <div style={S.mid}>
              <span style={{ color: "#475569" }}>Machine ID: </span>{machineId.slice(0, 32)}...
            </div>
          )}
          <p style={{ color: "#334155", fontSize: "11px", marginTop: "16px" }}>
            Internet connection required for first activation only.
          </p>
        </div>
      </div>
    );
  }

  // status === "valid"
  return (
    <>
      {expiry && (
        <div style={{
          position: "fixed", bottom: 8, right: 12, zIndex: 9999,
          fontSize: "10px", color: "#334155",
        }}>
          License expires: {new Date(expiry).toLocaleDateString()}
        </div>
      )}
      {children}
    </>
  );
}
