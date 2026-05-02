import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../api/client";
import { Modal, PageHeader } from "../../components/UI";

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "44px",
        height: "24px",
        borderRadius: "9999px",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.2s",
        background: checked ? "#6366f1" : "#404040",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

export default function BackupPage({ embedded = false }) {
  const [status, setStatus] = useState(null);       // backup status from API
  const [loading, setLoading] = useState(null);     // "manual" | "toggle" | "status"
  const [keepHistory, setKeepHistory] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [restoring, setRestoring] = useState(false);
  const hasElectron = !!window.electronAPI;

  const loadStatus = async () => {
    setLoading("status");
    try {
      const { data } = await api.get("/settings/backup/status");
      setStatus(data);
      setKeepHistory(data.keep_history ?? false);
    } catch {
      // backend might not have backup endpoints yet — fail silently
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  // Manual backup — calls backend which copies the DB file
  const handleManualBackup = async () => {
    setLoading("manual");
    try {
      const { data } = await api.post("/settings/backup/now");
      toast.success("Backup created successfully");
      setStatus((prev) => ({ ...prev, last_backup_at: data.backed_up_at, backup_exists: true }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Backup failed");
    } finally {
      setLoading(null);
    }
  };

  // Toggle auto-backup on/off
  const handleToggleAuto = async () => {
    if (!status) return;
    const enabling = !status.enabled;
    setLoading("toggle");
    try {
      const { data } = await api.post("/settings/backup/configure", {
        enabled: enabling,
        keep_history: keepHistory,
      });
      setStatus((prev) => ({
        ...prev,
        enabled: data.auto_backup ?? enabling,
        last_backup_at: data.backed_up_at ?? prev?.last_backup_at,
        next_backup_at: data.next_backup_at ?? null,
        backup_exists: data.ok ? true : prev?.backup_exists,
      }));
      toast.success(enabling ? "Auto backup enabled — backup created immediately" : "Auto backup disabled");
      // Refresh to get next_backup_at from scheduler
      setTimeout(loadStatus, 800);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to configure auto backup");
    } finally {
      setLoading(null);
    }
  };

  // Keep-history toggle — reconfigure with new setting
  const handleKeepHistoryChange = async (next) => {
    setKeepHistory(next);
    if (status?.enabled) {
      try {
        await api.post("/settings/backup/configure", { enabled: true, keep_history: next });
        toast.success(next ? "History mode on — each backup saved separately" : "Overwrite mode on — single backup file");
        loadStatus();
      } catch {
        toast.error("Failed to update backup mode");
      }
    }
  };

  // Electron restore (file-picker based, still needs Electron)
  const handleRestore = async (e) => {
    e.preventDefault();
    if (!hasElectron) return toast.error("Restore only available in the desktop app");
    setRestoring(true);
    try {
      const result = await window.electronAPI.backupRestore();
      if (result.ok) {
        toast.success("Backup restored. Restarting…");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.info("Restore cancelled");
      }
    } catch {
      toast.error("Restore failed");
    } finally {
      setRestoring(false);
      setShowRestoreConfirm(false);
      setAdminPassword("");
    }
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleString() : "—";

  return (
    <div className="space-y-4">
      {!embedded && <PageHeader title="Backup & Restore" subtitle="Protect your data with regular backups" />}

      <div className="grid gap-4 md:grid-cols-2">

        {/* Manual Backup */}
        <div className="panel space-y-4">
          <div>
            <p className="font-semibold">Manual Backup</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Immediately copy the database to the backup folder.
            </p>
            {status?.last_backup_at && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                Last backup: {fmt(status.last_backup_at)}
              </p>
            )}
            {status?.backup_path && (
              <p className="mt-1 text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                {status.backup_path}
              </p>
            )}
          </div>
          <button
            className="btn-primary w-full"
            onClick={handleManualBackup}
            disabled={loading === "manual"}
          >
            {loading === "manual" ? "Creating backup…" : "Create Backup Now"}
          </button>
        </div>

        {/* Auto Backup */}
        <div className="panel space-y-4">
          <div>
            <p className="font-semibold">Auto Backup (every 24h)</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Automatically backs up every 24 hours. Runs immediately when enabled.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Toggle
              checked={status?.enabled ?? false}
              onChange={handleToggleAuto}
              disabled={loading === "toggle" || loading === "status"}
            />
            <span className="text-sm" style={{ color: status?.enabled ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {loading === "toggle" ? "Updating…" : status?.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {status?.enabled && (
            <div className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              {status.last_backup_at && <p>Last: {fmt(status.last_backup_at)}</p>}
              {status.next_backup_at && <p>Next: {fmt(status.next_backup_at)}</p>}
            </div>
          )}

          {/* Keep history option */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={keepHistory}
              onChange={(e) => handleKeepHistoryChange(e.target.checked)}
            />
            <span>Keep history backups (one file per day)</span>
          </label>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {keepHistory
              ? "Each backup saved as a separate dated file."
              : "Single file overwritten each time (saves disk space)."}
          </p>
        </div>

        {/* Restore */}
        <div className="panel space-y-4 md:col-span-2">
          <div>
            <p className="font-semibold">Restore Backup</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Replace the current database with a backup file. Requires the desktop app and admin password.
            </p>
          </div>
          <button
            className="btn-soft border-rose-800 text-rose-400"
            onClick={() => setShowRestoreConfirm(true)}
            disabled={!hasElectron}
          >
            Restore from Backup…
          </button>
          {!hasElectron && (
            <p className="text-xs text-amber-400">Restore is only available in the desktop application.</p>
          )}
        </div>
      </div>

      <Modal title="Confirm Restore" open={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} maxWidth="max-w-md">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          This replaces all current data with the backup. This action cannot be undone.
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
            <button type="submit" className="btn-primary" disabled={restoring}>
              {restoring ? "Restoring…" : "Restore & Restart"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
