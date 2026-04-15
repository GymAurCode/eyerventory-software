import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, Modal, PageHeader } from "../components/UI";

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff", ownership_percentage: "" });

  const load = () => api.get("/users").then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

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

  return (
    <div className="space-y-4">
      <PageHeader title="User Management" subtitle="Create and manage owners and staff accounts" />
      <form className="panel grid gap-3 md:grid-cols-3" onSubmit={createUser}>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="staff">Staff</option><option value="owner">Owner</option>
        </select>
        {form.role === "owner" && <input className="input" type="number" min="1" max="99" step="0.01" placeholder="Owner %" value={form.ownership_percentage} onChange={(e) => setForm({ ...form, ownership_percentage: e.target.value })} />}
        <button className="btn-primary">Create User</button>
      </form>

      {rows.length === 0 ? <EmptyState title="No users" description="Create users for role-based access." /> : (
        <DataTable
          data={rows}
          searchPlaceholder="Search users by name, email, role, or status..."
          searchableColumns={["name", "email", "role", "status"]}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (row) => row.role.toUpperCase() },
            { key: "status", label: "Status" },
            {
              key: "actions",
              label: "Actions",
              align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => { setSelected(row); setViewOpen(true); }}
                  onEdit={() => { setSelected(row); setForm((prev) => ({ ...prev, name: row.name, email: row.email, role: row.role, password: "" })); setEditOpen(true); }}
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
          <input className="input" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          <input className="input" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
          <input className="input" type="password" placeholder="New password (optional)" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
          <select className="input" value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          {selected && <button type="button" className="btn-soft" onClick={() => toggleStatus(selected)}>{selected.status === "active" ? "Block User" : "Unblock User"}</button>}
          <button className="btn-primary">Update User</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        description={`Delete user "${deleting?.name || ""}"?`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}
