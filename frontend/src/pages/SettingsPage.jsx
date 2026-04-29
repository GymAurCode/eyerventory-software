import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, Modal, PageHeader } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { formatPKR } from "../utils/currency";

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = ["General", "Users", "Backup"];

function Tabs({ active, onChange }) {
  return (
    <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
          style={
            active === tab
              ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
              : { background: "transparent", color: "var(--text-secondary)" }
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── General tab ───────────────────────────────────────────────────────────────
function GeneralTab() {
  const { companyName, updateCompanyName, setLocalCompanyName } = useBranding();
  const [donation, setDonation] = useState({ enabled: false, percentage: 0, donation_amount: 0 });
  const [brandingName, setBrandingName] = useState(companyName);
  const [savingBranding, setSavingBranding] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [clearingData, setClearingData] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", confirm_password: "" });

  const getApiError = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((i) => i?.msg).filter(Boolean).join(", ") || fallback;
    return fallback;
  };

  const load = () => api.get("/settings/donation").then((r) => setDonation(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { setBrandingName(companyName); }, [companyName]);

  const saveDonation = async () => {
    try {
      const { data } = await api.put("/settings/donation", { enabled: donation.enabled, percentage: Number(donation.percentage || 0) });
      setDonation(data);
      toast.success("Donation settings updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update donation settings");
    }
  };

  const saveBranding = async () => {
    const cleanName = brandingName.trim();
    if (cleanName.length < 2) { toast.error("Company name must be at least 2 characters"); return; }
    setSavingBranding(true);
    try {
      await updateCompanyName(cleanName);
      toast.success("Company name updated");
    } catch (err) {
      setLocalCompanyName(cleanName);
      toast.error(`${getApiError(err, "Failed to save")} — saved locally as fallback.`);
    } finally {
      setSavingBranding(false);
    }
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (passwordForm.new_password !== passwordForm.confirm_password) { toast.error("Passwords do not match"); return; }
    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", passwordForm);
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(getApiError(err, "Failed to change password"));
    } finally {
      setChangingPassword(false);
    }
  };

  const clearBusinessData = async (e) => {
    e.preventDefault();
    if (!clearDataPassword.trim()) { toast.error("Owner password is required"); return; }
    setClearingData(true);
    try {
      await api.post("/settings/clear-data", { password: clearDataPassword });
      setClearDataPassword("");
      setClearDataOpen(false);
      await load();
      toast.success("Business data cleared successfully");
    } catch (err) {
      toast.error(getApiError(err, "Failed to clear business data"));
    } finally {
      setClearingData(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Branding */}
      <div className="panel space-y-3">
        <h3 className="font-semibold">Company Branding</h3>
        <div className="max-w-md">
          <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Company Name</label>
          <input className="input" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} maxLength={120} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Used across login, sidebar, and report headers.</p>
        <button className="btn-primary" onClick={saveBranding} disabled={savingBranding || brandingName.trim().length < 2}>
          {savingBranding ? "Saving..." : "Save Company Name"}
        </button>
      </div>

      {/* Password */}
      <div className="panel space-y-3">
        <h3 className="font-semibold">Change Password</h3>
        <form className="grid max-w-xl gap-3" onSubmit={submitPasswordChange}>
          {[["Old Password", "old_password"], ["New Password", "new_password"], ["Confirm Password", "confirm_password"]].map(([label, key]) => (
            <div key={key}>
              <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>{label}</label>
              <input className="input" type="password" minLength={key !== "old_password" ? 6 : undefined} value={passwordForm[key]} onChange={(e) => setPasswordForm((p) => ({ ...p, [key]: e.target.value }))} required />
            </div>
          ))}
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Owner account can use the recovery key in place of old password.</p>
          <button className="btn-primary w-fit" disabled={changingPassword || passwordForm.new_password.length < 6 || passwordForm.new_password !== passwordForm.confirm_password}>
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      {/* Donation */}
      <div className="panel space-y-3">
        <h3 className="font-semibold">Donation System</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={donation.enabled} onChange={(e) => setDonation({ ...donation, enabled: e.target.checked })} />
          <span className="text-sm">Enable donation deduction</span>
        </label>
        {donation.enabled && (
          <input className="input max-w-[240px]" type="number" min="0" max="100" step="0.01" value={donation.percentage} onChange={(e) => setDonation({ ...donation, percentage: e.target.value })} />
        )}
        <p className="text-sm">Current donation amount: <span className="font-semibold">{formatPKR(donation.donation_amount)}</span></p>
        <button className="btn-primary" onClick={saveDonation}>Save Donation Settings</button>
      </div>

      {/* Danger zone */}
      <div className="panel space-y-3">
        <h3 className="font-semibold">Danger Zone</h3>
        <button className="btn-soft border-rose-500/30 text-rose-600 dark:text-rose-400" onClick={() => setClearDataOpen(true)}>
          Clear Business Data
        </button>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Removes all products, sales, and expenses. Owner password required.</p>
      </div>

      <Modal title="Clear Business Data" open={clearDataOpen} onClose={() => !clearingData && setClearDataOpen(false)} maxWidth="max-w-md">
        <form className="space-y-3" onSubmit={clearBusinessData}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>This permanently removes all products, sales, and expenses. Enter owner password to continue.</p>
          <input className="input" type="password" placeholder="Owner password" value={clearDataPassword} onChange={(e) => setClearDataPassword(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={() => setClearDataOpen(false)} disabled={clearingData}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={clearingData || !clearDataPassword.trim()}>
              {clearingData ? "Clearing..." : "Confirm Clear Data"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [rows, setRows] = useState([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });

  const load = () => api.get("/users").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", { ...form, ownership_percentage: form.role === "owner" ? Number(form.ownership_percentage || 50) : undefined });
      toast.success("User created");
      setForm({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/users/${deleting.id}`);
      toast.success("User deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user");
    }
  };

  const toggleStatus = async (row) => {
    const next = row.status === "active" ? "blocked" : "active";
    try {
      await api.put(`/users/${row.id}`, { status: next });
      toast.success(`User ${next}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update status");
    }
  };

  const editUser = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.put(`/users/${selected.id}`, { name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) });
      toast.success("User updated");
      setEditOpen(false);
      setSelected(null);
      setForm({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user");
    }
  };

  return (
    <div className="space-y-4">
      <form className="panel grid gap-3 md:grid-cols-3" onSubmit={createUser}>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        {form.role === "owner" && (
          <input className="input" type="number" min="1" max="99" step="0.01" placeholder="Owner %" value={form.ownership_percentage} onChange={(e) => setForm({ ...form, ownership_percentage: e.target.value })} />
        )}
        <button className="btn-primary">Create User</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No users" description="Create users for role-based access." />
      ) : (
        <DataTable
          data={rows}
          searchPlaceholder="Search by name, email, role..."
          searchableColumns={["name", "email", "role", "status"]}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (row) => row.role.toUpperCase() },
            { key: "status", label: "Status" },
            {
              key: "actions", label: "Actions", align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => { setSelected(row); setViewOpen(true); }}
                  onEdit={() => { setSelected(row); setForm((p) => ({ ...p, name: row.name, email: row.email, role: row.role, password: "" })); setEditOpen(true); }}
                  onDelete={() => setDeleting(row)}
                />
              ),
            },
          ]}
        />
      )}

      <Modal title="User Details" open={viewOpen} onClose={() => setViewOpen(false)}>
        {selected && (
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {selected.name}</p>
            <p><strong>Email:</strong> {selected.email}</p>
            <p><strong>Role:</strong> {selected.role}</p>
            <p><strong>Status:</strong> {selected.status}</p>
          </div>
        )}
      </Modal>

      <Modal title="Edit User" open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="grid gap-3" onSubmit={editUser}>
          <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          <input className="input" type="password" placeholder="New password (optional)" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          <select className="input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          {selected && (
            <button type="button" className="btn-soft" onClick={() => toggleStatus(selected)}>
              {selected.status === "active" ? "Block User" : "Unblock User"}
            </button>
          )}
          <button className="btn-primary">Update User</button>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} description={`Delete user "${deleting?.name || ""}"?`} onClose={() => setDeleting(null)} onConfirm={remove} />
    </div>
  );
}

// ── Backup tab ────────────────────────────────────────────────────────────────
function BackupTab() {
  const [hasElectron, setHasElectron] = useState(false);
  const [loading, setLoading] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(localStorage.getItem("hr_auto_backup") === "1");
  const [lastBackup, setLastBackup] = useState(localStorage.getItem("hr_last_backup") || null);

  useEffect(() => { setHasElectron(!!window.electronAPI); }, []);

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
    } catch { toast.error("Backup failed"); }
    finally { setLoading(null); }
  };

  const handleRestore = async (e) => {
    e.preventDefault();
    setLoading("restore");
    try {
      const result = await window.electronAPI.backupRestore();
      if (result.ok) {
        toast.success("Backup restored. Restarting...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.info("Restore cancelled");
      }
    } catch { toast.error("Restore failed"); }
    finally { setLoading(null); setShowRestoreConfirm(false); setAdminPassword(""); }
  };

  const toggleAutoBackup = () => {
    const next = !autoBackupEnabled;
    setAutoBackupEnabled(next);
    localStorage.setItem("hr_auto_backup", next ? "1" : "0");
    if (window.electronAPI?.setAutoBackup) window.electronAPI.setAutoBackup(next);
    toast.success(next ? "Auto backup enabled (every 24h)" : "Auto backup disabled");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Manual backup */}
      <div className="panel space-y-4">
        <div>
          <p className="font-semibold">Manual Backup</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Save a copy of the database to your chosen location.</p>
          {lastBackup && <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>Last backup: {lastBackup}</p>}
        </div>
        <button className="btn-primary w-full" onClick={handleManualBackup} disabled={loading === "backup" || !hasElectron}>
          {loading === "backup" ? "Saving..." : "Create Backup"}
        </button>
        {!hasElectron && <p className="text-xs text-amber-400">Only available in the desktop application.</p>}
      </div>

      {/* Auto backup */}
      <div className="panel space-y-4">
        <div>
          <p className="font-semibold">Auto Backup</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Automatically backup every 24 hours to the app data folder.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAutoBackup}
            role="switch"
            aria-checked={autoBackupEnabled}
            style={{ position: "relative", display: "inline-flex", alignItems: "center", width: "44px", height: "24px", borderRadius: "9999px", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, transition: "background 0.2s", background: autoBackupEnabled ? "#6366f1" : "#404040" }}
          >
            <span style={{ position: "absolute", top: "3px", left: autoBackupEnabled ? "23px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transition: "left 0.2s" }} />
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
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Replace the current database with a backup file. This will restart the application.</p>
        </div>
        <button className="btn-soft border-rose-800 text-rose-400" onClick={() => setShowRestoreConfirm(true)} disabled={!hasElectron}>
          Restore from Backup...
        </button>
      </div>

      <Modal title="Confirm Restore" open={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} maxWidth="max-w-md">
        <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>This will replace all current data with the backup. This action cannot be undone.</p>
        <form onSubmit={handleRestore} className="space-y-4">
          <input className="input w-full" type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Admin password" />
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

// ── Main Settings page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("General");

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="General configuration, user management, and backup controls" />
      <Tabs active={activeTab} onChange={setActiveTab} />
      {activeTab === "General" && <GeneralTab />}
      {activeTab === "Users"   && <UsersTab />}
      {activeTab === "Backup"  && <BackupTab />}
    </div>
  );
}
