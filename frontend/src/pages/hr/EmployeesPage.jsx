import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createEmployee, getEmployees, updateEmployee } from "../../api/hr";
import { ConfirmDialog, DataTable, Modal, PageHeader } from "../../components/UI";

const EMPTY_FORM = {
  name: "", cnic: "", phone: "", role: "staff",
  employment_type: "monthly", salary: "", daily_wage: "",
  job_start_time: "", job_end_time: "", grace_minutes: 10,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // employee to soft-delete

  const load = () => {
    setLoading(true);
    getEmployees()
      .then(setEmployees)
      .catch(() => toast.error("Failed to load employees"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      name: emp.name, cnic: emp.cnic || "", phone: emp.phone || "",
      role: emp.role, employment_type: emp.employment_type,
      salary: emp.salary || "", daily_wage: emp.daily_wage || "",
      job_start_time: emp.job_start_time || "", job_end_time: emp.job_end_time || "",
      grace_minutes: emp.grace_minutes,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      salary: form.salary ? parseFloat(form.salary) : null,
      daily_wage: form.daily_wage ? parseFloat(form.daily_wage) : null,
      grace_minutes: parseInt(form.grace_minutes),
    };
    try {
      if (editing) {
        await updateEmployee(editing.id, payload);
        toast.success("Employee updated");
      } else {
        await createEmployee(payload);
        toast.success("Employee added");
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  // Soft delete — sets is_active = false (audit-safe, no data loss)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await updateEmployee(deleteTarget.id, { is_active: false });
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Failed to remove employee");
    }
  };

  const handleRestore = async (emp) => {
    try {
      await updateEmployee(emp.id, { is_active: true });
      toast.success(`${emp.name} restored`);
      load();
    } catch {
      toast.error("Failed to restore employee");
    }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "cnic", label: "CNIC", render: (r) => r.cnic || "-" },
    { key: "phone", label: "Phone", render: (r) => r.phone || "-" },
    { key: "role", label: "Role", render: (r) => <span className="capitalize">{r.role}</span> },
    { key: "employment_type", label: "Type", render: (r) => <span className="capitalize">{r.employment_type}</span> },
    {
      key: "salary_display", label: "Salary/Wage",
      render: (r) => r.employment_type === "monthly"
        ? `PKR ${r.salary?.toLocaleString() || "-"}`
        : `PKR ${r.daily_wage?.toLocaleString() || "-"}/day`,
    },
    {
      key: "is_active", label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.is_active ? "bg-emerald-900/40 text-emerald-400" : "bg-rose-900/40 text-rose-400"}`}>
          {r.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button className="btn-soft px-3 py-1 text-xs" onClick={() => openEdit(r)}>
            Edit
          </button>
          {r.is_active ? (
            <button
              className="btn-soft px-3 py-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => setDeleteTarget(r)}
            >
              Delete
            </button>
          ) : (
            <button
              className="btn-soft px-3 py-1 text-xs text-emerald-400"
              onClick={() => handleRestore(r)}
            >
              Restore
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce"
        actions={<button className="btn-primary" onClick={openAdd}>+ Add Employee</button>}
      />

      {loading ? <div className="panel">Loading...</div> : (
        <DataTable columns={columns} data={employees} searchPlaceholder="Search employees..." />
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={editing ? "Edit Employee" : "Add Employee"}
        open={showModal}
        onClose={() => setShowModal(false)}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm">Name *</label>
              <input className="input w-full" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">CNIC</label>
              <input className="input w-full" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" />
            </div>
            <div>
              <label className="mb-1 block text-sm">Phone</label>
              <input className="input w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Role *</label>
              <select className="input w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Staff</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">Employment Type *</label>
              <select className="input w-full" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            {form.employment_type === "monthly" ? (
              <div>
                <label className="mb-1 block text-sm">Monthly Salary *</label>
                <input className="input w-full" type="number" min="0" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm">Daily Wage *</label>
                <input className="input w-full" type="number" min="0" value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: e.target.value })} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm">Job Start Time</label>
              <input className="input w-full" type="time" value={form.job_start_time} onChange={(e) => setForm({ ...form, job_start_time: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Job End Time</label>
              <input className="input w-full" type="time" value={form.job_end_time} onChange={(e) => setForm({ ...form, job_end_time: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">Grace Minutes</label>
              <input className="input w-full" type="number" min="0" max="60" value={form.grace_minutes} onChange={(e) => setForm({ ...form, grace_minutes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Employee"
        description={`Remove ${deleteTarget?.name}? They will be marked inactive and hidden from active lists. This can be undone with Restore.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
