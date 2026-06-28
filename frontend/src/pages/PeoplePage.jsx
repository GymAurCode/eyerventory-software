import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import api from "../api/client";
import { partnerAgreementApi } from "../api/partnerAgreements";
import {
  ActionButtons,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
} from "../components/UI";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";
import SalesBreakdownTab from "./SalesBreakdownPage";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function useTabParam(defaultTab = "users") {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(location.search).get("tab") || defaultTab;
  const setTab = (t) => navigate(`/people?tab=${t}`, { replace: true });
  return [tab, setTab];
}

function UsersTab() {
  const [rows, setRows] = useState([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });

  const load = () => api.get("/users").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", {
        ...form,
        ownership_percentage: form.role === "owner" ? Number(form.ownership_percentage || 50) : undefined,
      });
      toast.success("User created");
      setForm({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create user");
    }
  };

  const editUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${selected.id}`, {
        name: form.name,
        email: form.email,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      });
      toast.success("User updated");
      setEditOpen(false);
      setSelected(null);
      setForm({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update user");
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

  const remove = async () => {
    try {
      await api.delete(`/users/${deleting.id}`);
      toast.success("User deleted");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete user");
    }
  };

  return (
    <div className="space-y-4">
      <form className="panel grid gap-3 md:grid-cols-3" onSubmit={createUser}>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => set("password", e.target.value)} required />
        <select className="input" value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="staff">Staff</option>
          <option value="owner">Owner</option>
        </select>
        {form.role === "owner" && (
          <input className="input" type="number" min="1" max="99" step="0.01" placeholder="Owner %" value={form.ownership_percentage} onChange={(e) => set("ownership_percentage", e.target.value)} />
        )}
        <button className="btn-primary">Create User</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No users" description="Create users for role-based access." />
      ) : (
        <DataTable
          data={rows}
          searchPlaceholder="Search by name, email, role or status…"
          searchableColumns={["name", "email", "role", "status"]}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (r) => r.role.toUpperCase() },
            { key: "status", label: "Status" },
            {
              key: "actions", label: "Actions", align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => { setSelected(row); setViewOpen(true); }}
                  onEdit={() => {
                    setSelected(row);
                    setForm({ name: row.name, email: row.email, role: row.role, password: "", ownership_percentage: "" });
                    setEditOpen(true);
                  }}
                  onPrint={() => printRecord({
                    title: "User Details",
                    fields: [
                      { label: "Name", value: row.name },
                      { label: "Email", value: row.email },
                      { label: "Role", value: row.role },
                      { label: "Status", value: row.status || "Active" },
                    ],
                  })}
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
            <p><span className="font-semibold">Name:</span> {selected.name}</p>
            <p><span className="font-semibold">Email:</span> {selected.email}</p>
            <p><span className="font-semibold">Role:</span> {selected.role}</p>
            <p><span className="font-semibold">Status:</span> {selected.status}</p>
          </div>
        )}
      </Modal>

      <Modal title="Edit User" open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="grid gap-3" onSubmit={editUser}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          <input className="input" type="password" placeholder="New password (optional)" value={form.password} onChange={(e) => set("password", e.target.value)} />
          <select className="input" value={form.role} onChange={(e) => set("role", e.target.value)}>
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

      <ConfirmDialog
        open={!!deleting}
        description={`Delete user "${deleting?.name}"?`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function AgreementDialog({ open, onClose, partner, existingAgreement, onSaved }) {
  const [form, setForm] = useState({
    agreement_start_date: "",
    agreement_end_date: "",
    duration_value: "",
    duration_unit: "months",
    has_investment: false,
    investment_amount: "",
    profit_share_percent: "",
    status: "active",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);

  useEffect(() => {
    if (existingAgreement) {
      setForm({
        agreement_start_date: existingAgreement.agreement_start_date || "",
        agreement_end_date: existingAgreement.agreement_end_date || "",
        duration_value: existingAgreement.duration_value ?? "",
        duration_unit: existingAgreement.duration_unit || "months",
        has_investment: existingAgreement.has_investment || false,
        investment_amount: existingAgreement.investment_amount ?? "",
        profit_share_percent: existingAgreement.profit_share_percent || "",
        status: existingAgreement.status || "active",
        notes: existingAgreement.notes || "",
      });
      setShowEndDate(!!existingAgreement.agreement_end_date);
    } else {
      setForm({
        agreement_start_date: new Date().toISOString().slice(0, 10),
        agreement_end_date: "",
        duration_value: "",
        duration_unit: "months",
        has_investment: false,
        investment_amount: "",
        profit_share_percent: partner?.ownership_percentage || "",
        status: "active",
        notes: "",
      });
      setShowEndDate(false);
    }
  }, [existingAgreement, partner, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        user_id: partner.user_id,
        agreement_start_date: form.agreement_start_date,
        agreement_end_date: showEndDate && form.agreement_end_date ? form.agreement_end_date : null,
        duration_value: form.duration_value ? Number(form.duration_value) : null,
        duration_unit: form.duration_value ? form.duration_unit : null,
        has_investment: form.has_investment,
        investment_amount: form.has_investment && form.investment_amount ? Number(form.investment_amount) : null,
        profit_share_percent: Number(form.profit_share_percent),
        status: form.status,
        notes: form.notes || null,
      };
      if (existingAgreement) {
        await partnerAgreementApi.update(existingAgreement.id, payload);
        toast.success("Agreement updated");
      } else {
        await partnerAgreementApi.create(payload);
        toast.success("Agreement created");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save agreement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={existingAgreement ? "Edit Agreement" : "New Agreement"} open={open} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={save} className="space-y-5">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
          <p className="text-sm font-semibold">{partner?.name}</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{partner?.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Agreement Start Date <span className="text-rose-400">*</span>
            </label>
            <input className="input" type="date" value={form.agreement_start_date} onChange={(e) => set("agreement_start_date", e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Profit Share % <span className="text-rose-400">*</span>
            </label>
            <input className="input" type="number" min="0.01" max="100" step="0.01" value={form.profit_share_percent} onChange={(e) => set("profit_share_percent", e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Duration Value</label>
            <input className="input" type="number" min="1" value={form.duration_value} onChange={(e) => set("duration_value", e.target.value)} placeholder="e.g. 12" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Duration Unit</label>
            <select className="input" value={form.duration_unit} onChange={(e) => set("duration_unit", e.target.value)} disabled={!form.duration_value}>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="w-4 h-4 accent-teal-500" checked={showEndDate} onChange={(e) => setShowEndDate(e.target.checked)} />
            Set End Date
          </label>
          {showEndDate && (
            <input className="input max-w-[200px]" type="date" value={form.agreement_end_date} onChange={(e) => set("agreement_end_date", e.target.value)} />
          )}
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border-color)" }}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="w-4 h-4 accent-teal-500" checked={form.has_investment} onChange={(e) => set("has_investment", e.target.checked)} />
            This partnership involves investment
          </label>
          {form.has_investment && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Investment Amount (PKR) <span className="text-rose-400">*</span>
              </label>
              <input className="input" type="number" min="0" step="0.01" value={form.investment_amount} onChange={(e) => set("investment_amount", e.target.value)} placeholder="Enter amount" required />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          {form.status === "ended" && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                End Date <span className="text-rose-400">*</span>
              </label>
              <input className="input" type="date" value={form.agreement_end_date} onChange={(e) => set("agreement_end_date", e.target.value)} required />
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Notes / Terms (optional)</label>
          <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any special terms or notes..." />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : existingAgreement ? "Update Agreement" : "Create Agreement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AgreementHistoryModal({ open, onClose, partner, agreements }) {
  return (
    <Modal title={`Agreement History — ${partner?.name}`} open={open} onClose={onClose} maxWidth="max-w-3xl">
      {agreements.length === 0 ? (
        <EmptyState title="No agreements" description="This partner has no agreement records yet." />
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {agreements.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border p-4 space-y-2"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {a.agreement_start_date} — {a.agreement_end_date || "Present"}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  a.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                  a.status === "ended" ? "bg-rose-500/20 text-rose-400" :
                  "bg-amber-500/20 text-amber-400"
                }`}>
                  {a.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>Share: <strong className="text-[var(--text-primary)]">{a.profit_share_percent}%</strong></span>
                {a.has_investment && <span>Investment: <strong className="text-[var(--text-primary)]">{formatPKR(a.investment_amount)}</strong></span>}
                {a.duration_value && <span>Duration: <strong className="text-[var(--text-primary)]">{a.duration_value} {a.duration_unit}</strong></span>}
              </div>
              {a.notes && <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>{a.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function PartnersTab() {
  const [rows, setRows] = useState([]);
  const [agreementsMap, setAgreementsMap] = useState({});
  const [editing, setEditing] = useState({});
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [partnerAgreements, setPartnerAgreements] = useState([]);

  const load = () => api.get("/partners").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const loadAgreementsForPartner = async (userId) => {
    try {
      const agreements = await partnerAgreementApi.listByUser(userId);
      setAgreementsMap((prev) => ({ ...prev, [userId]: agreements }));
      return agreements;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    if (rows.length > 0) {
      rows.forEach((r) => loadAgreementsForPartner(r.user_id));
    }
  }, [rows]);

  const save = async (row) => {
    const pct = Number(editing[row.user_id] ?? row.ownership_percentage);
    try {
      await api.put(`/partners/${row.user_id}/percentage`, { ownership_percentage: pct });
      toast.success("Ownership updated");
      setEditing((prev) => { const n = { ...prev }; delete n[row.user_id]; return n; });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update ownership");
    }
  };

  const openNewAgreement = (partner) => {
    setSelectedPartner(partner);
    setSelectedAgreement(null);
    setAgreementOpen(true);
  };

  const openEditAgreement = async (partner) => {
    setSelectedPartner(partner);
    const agreements = await loadAgreementsForPartner(partner.user_id);
    const current = agreements.find((a) => a.status === "active") || agreements[0];
    setSelectedAgreement(current || null);
    setAgreementOpen(true);
  };

  const openHistory = async (partner) => {
    setSelectedPartner(partner);
    const agreements = await loadAgreementsForPartner(partner.user_id);
    setPartnerAgreements(agreements);
    setHistoryOpen(true);
  };

  const totalPct = rows.reduce((sum, r) => sum + Number(r.ownership_percentage || 0), 0);

  return (
    <div className="space-y-4">
      <div className="panel flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Total ownership: <span className={`font-semibold ${Math.abs(totalPct - 100) < 0.01 ? "text-green-500" : "text-red-500"}`}>{totalPct.toFixed(2)}%</span>
          <span className="ml-2" style={{ color: "var(--text-muted)" }}>(must equal 100%)</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No partners" description="Owner-role users appear here with their profit share." />
      ) : (
        <DataTable
          data={rows}
          rowKey="user_id"
          searchPlaceholder="Search partners by name or ownership…"
          searchableColumns={["name", "ownership_percentage"]}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            {
              key: "ownership_percentage", label: "Ownership %",
              render: (r) => (
                <input
                  className="input max-w-[120px]"
                  type="number"
                  min="0.01"
                  max="99.99"
                  step="0.01"
                  value={editing[r.user_id] ?? r.ownership_percentage}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [r.user_id]: e.target.value }))}
                />
              ),
            },
            { key: "profit_share", label: "Profit Share", render: (r) => formatPKR(r.profit_share) },
            {
              key: "agreement", label: "Agreement",
              render: (r) => {
                const agreements = agreementsMap[r.user_id];
                if (!agreements || agreements.length === 0) {
                  return <span className="text-xs text-amber-400">No agreement</span>;
                }
                const current = agreements.find((a) => a.status === "active");
                if (current) {
                  return (
                    <span className="text-xs">
                      <span className="text-emerald-400 font-semibold">{current.profit_share_percent}%</span>
                      <span className="ml-1" style={{ color: "var(--text-secondary)" }}>
                        (since {current.agreement_start_date})
                      </span>
                    </span>
                  );
                }
                return <span className="text-xs text-amber-400">Inactive</span>;
              },
            },
            {
              key: "actions", label: "Actions", align: "right",
              render: (r) => (
                <div className="flex justify-end gap-1">
                  <button className="btn-soft text-xs px-2 py-1" onClick={() => openNewAgreement(r)} title="Add Agreement">
                    + Agreement
                  </button>
                  <button className="icon-btn icon-btn-edit" onClick={() => openEditAgreement(r)} title="Edit Agreement">
                    <i className="ti ti-edit" style={{ fontSize: "16px" }} />
                  </button>
                  <button className="icon-btn icon-btn-view" onClick={() => openHistory(r)} title="View History">
                    <i className="ti ti-history" style={{ fontSize: "16px" }} />
                  </button>
                  <button
                    className="btn-soft text-xs px-2 py-1"
                    onClick={() => save(r)}
                    disabled={editing[r.user_id] === undefined}
                  >
                    Save %
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <AgreementDialog
        open={agreementOpen}
        onClose={() => { setAgreementOpen(false); setSelectedPartner(null); setSelectedAgreement(null); }}
        partner={selectedPartner}
        existingAgreement={selectedAgreement}
        onSaved={load}
      />

      <AgreementHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        partner={selectedPartner}
        agreements={partnerAgreements}
      />
    </div>
  );
}

const TABS = [
  { id: "users",    label: "Users" },
  { id: "partners", label: "Partners" },
  { id: "sales-breakdown", label: "Sales Breakdown" },
];

export default function PeoplePage() {
  const [tab, setTab] = useTabParam("users");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team Management"
        subtitle="Manage users, partner agreements, and sales breakdown in one place."
      />

      <div
        className="flex gap-1 rounded-xl border p-1"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", width: "fit-content" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users"           && <UsersTab />}
      {tab === "partners"        && <PartnersTab />}
      {tab === "sales-breakdown" && <SalesBreakdownTab />}
    </div>
  );
}
