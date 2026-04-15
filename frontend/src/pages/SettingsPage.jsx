import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { Modal, PageHeader } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { formatPKR } from "../utils/currency";

export default function SettingsPage() {
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
    if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join(", ") || fallback;
    return fallback;
  };

  const load = () => api.get("/settings/donation").then((r) => setDonation(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => { setBrandingName(companyName); }, [companyName]);

  const saveDonation = async () => {
    try {
      const payload = { enabled: donation.enabled, percentage: Number(donation.percentage || 0) };
      const { data } = await api.put("/settings/donation", payload);
      setDonation(data);
      toast.success("Donation settings updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update donation settings");
    }
  };

  const saveBranding = async () => {
    const cleanName = brandingName.trim();
    if (cleanName.length < 2) {
      toast.error("Company name must be at least 2 characters");
      return;
    }
    setSavingBranding(true);
    try {
      await updateCompanyName(cleanName);
      toast.success("Company name updated");
    } catch (err) {
      setLocalCompanyName(cleanName);
      toast.error(`${getApiError(err, "Failed to save company name to server")} Saved locally as fallback.`);
    } finally {
      setSavingBranding(false);
    }
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Confirm password does not match");
      return;
    }
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

  const createBackup = async () => {
    const res = await window.desktop.backupDatabase();
    if (res.ok) toast.success("Backup created");
    else toast.error(res.message || "Backup failed");
  };

  const restoreBackup = async () => {
    const res = await window.desktop.restoreDatabase();
    if (!res.ok) toast.error(res.message || "Restore failed");
  };

  const clearBusinessData = async (e) => {
    e.preventDefault();
    if (!clearDataPassword.trim()) {
      toast.error("Owner password is required");
      return;
    }
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
      <PageHeader title="System Settings" subtitle="Branding, security, donation and backup controls" />

      <div className="panel space-y-3">
        <h3 className="text-lg font-semibold">Company Branding</h3>
        <div className="max-w-md">
          <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Company Name</label>
          <input className="input" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} maxLength={120} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>This name is used across login, sidebar, and report headers.</p>
        <button className="btn-primary" onClick={saveBranding} disabled={savingBranding || brandingName.trim().length < 2}>
          {savingBranding ? "Saving..." : "Save Company Name"}
        </button>
      </div>

      <div className="panel space-y-3">
        <h3 className="text-lg font-semibold">Change Password</h3>
        <form className="grid max-w-xl gap-3" onSubmit={submitPasswordChange}>
          <div>
            <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Old Password</label>
            <input className="input" type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, old_password: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>New Password</label>
            <input className="input" type="password" minLength={6} value={passwordForm.new_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))} required />
          </div>
          <div>
            <label className="mb-2 block text-sm" style={{ color: "var(--text-secondary)" }}>Confirm Password</label>
            <input className="input" type="password" minLength={6} value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))} required />
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            If you forget your password, owner account can use the configured recovery key in place of old password.
          </p>
          <button
            className="btn-primary w-fit"
            disabled={changingPassword || passwordForm.new_password.length < 6 || passwordForm.new_password !== passwordForm.confirm_password}
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <div className="panel space-y-3">
        <h3 className="text-lg font-semibold">Donation System</h3>
        <label className="flex items-center gap-2"><input type="checkbox" checked={donation.enabled} onChange={(e) => setDonation({ ...donation, enabled: e.target.checked })} /><span>Enable donation deduction</span></label>
        {donation.enabled && <input className="input max-w-[240px]" type="number" min="0" max="100" step="0.01" value={donation.percentage} onChange={(e) => setDonation({ ...donation, percentage: e.target.value })} />}
        <p className="text-sm">Current donation amount: <span className="font-semibold">{formatPKR(donation.donation_amount)}</span></p>
        <button className="btn-primary" onClick={saveDonation}>Save Donation Settings</button>
      </div>

      <div className="panel space-y-3">
        <h3 className="text-lg font-semibold">Backup & Restore</h3>
        <div className="space-x-2">
          <button className="btn-soft" onClick={createBackup}>Create Backup</button>
          <button className="btn-soft" onClick={restoreBackup}>Restore Backup</button>
          <button className="btn-soft border-rose-500/30 text-rose-700 dark:text-rose-300" onClick={() => setClearDataOpen(true)}>
            Clear Data
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Clear Data removes products, sales, and expenses. Owner password is required.
        </p>
      </div>

      <Modal title="Clear Business Data" open={clearDataOpen} onClose={() => !clearingData && setClearDataOpen(false)} maxWidth="max-w-md">
        <form className="space-y-3" onSubmit={clearBusinessData}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This action will permanently remove all products, sales, and expenses. Enter owner password to continue.
          </p>
          <input
            className="input"
            type="password"
            placeholder="Owner password"
            value={clearDataPassword}
            onChange={(e) => setClearDataPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-soft" onClick={() => setClearDataOpen(false)} disabled={clearingData}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={clearingData || !clearDataPassword.trim()}>
              {clearingData ? "Clearing..." : "Confirm Clear Data"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
