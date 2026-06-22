import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../api/client";
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

// ---------------------------------------------------------------------------
// Tab state via URL query param (?tab=users | ?tab=partners)
// ---------------------------------------------------------------------------
function useTabParam(defaultTab = "users") {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(location.search).get("tab") || defaultTab;
  const setTab = (t) => navigate(`/people?tab=${t}`, { replace: true });
  return [tab, setTab];
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
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
      {/* Create form */}
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

      {/* View modal */}
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

      {/* Edit modal */}
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

// ---------------------------------------------------------------------------
// Partners tab
// ---------------------------------------------------------------------------
function PartnersTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});

  const load = () => api.get("/partners").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

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
              key: "actions", label: "Action", align: "right",
              render: (r) => (
                <button
                  className="btn-soft text-sm"
                  onClick={() => save(r)}
                  disabled={editing[r.user_id] === undefined}
                >
                  Save
                </button>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const TABS = [
  { id: "users",    label: "Users" },
  { id: "partners", label: "Partners" },
];

export default function PeoplePage() {
  const [tab, setTab] = useTabParam("users");

  return (
    <div className="space-y-5">
      <PageHeader
        title="People"
        subtitle="Manage system users and owner partners in one place."
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

      {tab === "users"    && <UsersTab />}
      {tab === "partners" && <PartnersTab />}
    </div>
  );
}
