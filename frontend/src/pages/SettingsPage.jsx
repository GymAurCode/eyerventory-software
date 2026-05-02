import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../api/client";
import { Modal, PageHeader } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { formatPKR } from "../utils/currency";
import ReportsPage from "./ReportsPage";
import BackupPage from "./hr/BackupPage";

const TABS = [
  { id: "general", label: "General" },
  { id: "reports", label: "Reports" },
  { id: "backup",  label: "Backup" },
];

// Read ?tab= from hash query string (HashRouter uses hash-based URLs)
function useTabParam(defaultTab) {
  const location = useLocation();
  const navigate = useNavigate();

  const getTab = () => {
    const params = new URLSearchParams(location.search);
    return params.get("tab") || defaultTab;
  };

  const setTab = (tab) => {
    navigate(`/settings?tab=${tab}`, { replace: true });
  };

  return [getTab(), setTab];
}

// ---------------------------------------------------------------------------
// General tab content (extracted from old SettingsPage)
// ---------------------------------------------------------------------------
function GeneralSettings() {
  const { companyName, updateCompanyName, setLocalCompanyName } = useBranding();
  const [donation, setDonation] = useState({ enabled: false, percentage: 0, donation_amount: 0 });
  const [brandingName, setBrandingName] = useState(companyName);
  const [savingBranding, setSavingBranding] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [clearingData, setClearingData] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: "", new_password: "", confirm_password: "" });

  const getApiError = (error, fallback) => {
    const detail = error?.response?.data?.detail;
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
      toast.error(`${getApiError(err, "Failed to save")} Saved locally as fallback.`);
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
        <h3 className="text-base font-semibold">Company Branding</h3>
        <div className="max-w-md">
          <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Company Name</label>
          <input className="input" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} maxLength={120} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Used across login, sidebar, and report headers.</p>
        <button className="btn-primary" onClick={saveBranding} disabled={savingBranding || brandingName.trim().length < 2}>
          {savingBranding ? "Saving…" : "Save Company Name"}
        </button>
      </div>

      {/* Password */}
      <div className="panel space-y-3">
        <h3 className="text-base font-semibold">Change Password</h3>
        <form className="grid max-w-xl gap-3" onSubmit={submitPasswordChange}>
          {["old_password", "new_password", "confirm_password"].map((field) => (
            <div key={field}>
              <label className="mb-2 block text-sm capitalize" style={{ color: "var(--text-secondary)" }}>
                {field.replace(/_/g, " ")}
              </label>
              <input
                className="input"
                type="password"
                minLength={field !== "old_password" ? 6 : undefined}
                value={passwordForm[field]}
                onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                required
              />
            </div>
          ))}
          <button
            className="btn-primary w-fit"
            disabled={changingPassword || passwordForm.new_password.length < 6 || passwordForm.new_password !== passwordForm.confirm_password}
          >
            {changingPassword ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>

      {/* Donation */}
      <div className="panel space-y-3">
        <h3 className="text-base font-semibold">Donation System</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={donation.enabled} onChange={(e) => setDonation({ ...donation, enabled: e.target.checked })} />
          <span>Enable donation deduction</span>
        </label>
        {donation.enabled && (
          <input className="input max-w-[240px]" type="number" min="0" max="100" step="0.01"
            value={donation.percentage} onChange={(e) => setDonation({ ...donation, percentage: e.target.value })} />
        )}
        <p className="text-sm">Current donation amount: <span className="font-semibold">{formatPKR(donation.donation_amount)}</span></p>
        <button className="btn-primary" onClick={saveDonation}>Save Donation Settings</button>
      </div>

      {/* Danger zone */}
      <div className="panel space-y-3">
        <h3 className="text-base font-semibold text-red-500">Danger Zone</h3>
        <button className="btn-soft border-rose-500/30 text-rose-600" onClick={() => setClearDataOpen(true)}>
          Clear Business Data
        </button>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Removes all products, sales, and expenses. Owner password required.
        </p>
      </div>

      <Modal title="Clear Business Data" open={clearDataOpen} onClose={() => !clearingData && setClearDataOpen(false)} maxWidth="max-w-md">
        <form className="space-y-3" onSubmit={clearBusinessData}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This permanently removes all products, sales, and expenses. Enter owner password to continue.
          </p>
          <input className="input" type="password" placeholder="Owner password" value={clearDataPassword}
            onChange={(e) => setClearDataPassword(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={() => setClearDataOpen(false)} disabled={clearingData}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={clearingData || !clearDataPassword.trim()}>
              {clearingData ? "Clearing…" : "Confirm Clear Data"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SettingsPage with tabs
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useTabParam("general");

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="General configuration, reports, and backup management." />

      {/* Tab bar */}
      <div
        className="flex gap-1 rounded-xl border p-1"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", width: "fit-content" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — components are mounted/unmounted but never duplicated */}
      {activeTab === "general" && <GeneralSettings />}
      {activeTab === "reports"  && <ReportsPage embedded />}
      {activeTab === "backup"   && <BackupPage embedded />}
    </div>
  );
}
