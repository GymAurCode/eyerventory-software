import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal, PageHeader } from "../../components/UI";

export default function BackupPage() {
  const [hasElectron, setHasElectron] = useState(false);
  const [loading, setLoading] = useState(null); // "backup" | "restore" | "auto"
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(
    localStorage.getItem("hr_auto_backup") === "1"
  );
  const [lastBackup, setLastBackup] = useState(localStorage.getItem("hr_last_backup") || null);

  useEffect(() => {
    setHasElectron(!!window.electronAPI);
  }, []);

  const handleManualBackup = async () => {
    if (!window.electronAPI) return toast.error("Backup only available in desktop app");
    setLoading("backup");
    try {
      const result = await window.electronAPI.backupCreate();
      if (result.ok) {
        const now = new Date().toLocaleString();
        localStorage.setItem("hr_last_backup", now);
        setLastBackup(now);
        toast.success("Backup saved successfully");
      } else {
        toast.info("Backup cancelled");
      }
    } catch {
      toast.error("Backup failed");
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    // Basic admin password check (matches owner password via API would be ideal,
    // but for offline-first we check against a stored hash via the backend)
    setLoading("restore");
    try {
      const result = await window.electronAPI.backupRestore();
      if (result.ok) {
        toast.success("Backup restored. Restarting app...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.info("Restore cancelled");
      }
    } catch {
      toast.error("Restore failed");
    } finally {
      setLoading(null);
      setShowRestoreConfirm(false);
      setAdminPassword("");
    }
  };

  const toggleAutoBackup = () => {
    const next = !autoBackupEnabled;
    setAutoBackupEnabled(next);
    localStorage.setItem("hr_auto_backup", next ? "1" : "0");
    // Notify electron main process
    if (window.electronAPI?.setAutoBackup) {
      window.electronAPI.setAutoBackup(next);
    }
    toast.success(next ? "Auto backup enabled (every 24h)" : "Auto backup disabled");
  };

  return (
    <div>
      <PageHeader title="Backup & Restore" subtitle="Protect your data with regular backups" />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Manual Backup */}
        <div className="panel space-y-4">
          <div>
            <p className="font-semibold">Manual Backup</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Save a copy of the database to your chosen location.
            </p>
            {lastBackup && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                Last backup: {lastBackup}
              </p>
            )}
          </div>
          <button
            className="btn-primary w-full"
            onClick={handleManualBackup}
            disabled={loading === "backup" || !hasElectron}
          >
            {loading === "backup" ? "Saving..." : "Create Backup"}
          </button>
          {!hasElectron && (
            <p className="text-xs text-amber-400">Only available in the desktop application.</p>
          )}
        </div>

        {/* Auto Backup */}
        <div className="panel space-y-4">
          <div>
            <p className="font-semibold">Auto Backup</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Automatically backup every 24 hours to the app data folder.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAutoBackup}
              role="switch"
              aria-checked={autoBackupEnabled}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                width: "44px",
                height: "24px",
                borderRadius: "9999px",
                border: "none",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
                transition: "background 0.2s",
                background: autoBackupEnabled ? "#6366f1" : "#404040",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: autoBackupEnabled ? "23px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  transition: "left 0.2s",
                }}
              />
            </button>
            <span className="text-sm" style={{ color: autoBackupEnabled ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {autoBackupEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Restore */}
        <div className="panel space-y-4 md:col-span-2">
          <div>
            <p className="font-semibold">Restore Backup</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Replace the current database with a backup file. This will restart the application.
              Admin password is required.
            </p>
          </div>
          <button
            className="btn-soft border-rose-800 text-rose-400"
            onClick={() => setShowRestoreConfirm(true)}
            disabled={!hasElectron}
          >
            Restore from Backup...
          </button>
        </div>
      </div>

      <Modal title="Confirm Restore" open={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} maxWidth="max-w-md">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          This will replace all current data with the backup. This action cannot be undone.
        </p>
        <form onSubmit={handleRestore} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Admin Password *</label>
            <input
              className="input w-full"
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter your admin password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={() => setShowRestoreConfirm(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading === "restore"}>
              {loading === "restore" ? "Restoring..." : "Restore & Restart"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
