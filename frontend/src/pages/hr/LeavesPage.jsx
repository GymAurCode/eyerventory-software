import { useEffect, useState } from "react";
import { toast } from "sonner";
import { approveLeave, createLeave, getEmployees, getLeaves } from "../../api/hr";
import { DataTable, Modal, PageHeader } from "../../components/UI";

const TODAY = new Date().toISOString().slice(0, 10);

export default function LeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({ employee_id: "", type: "sick", start_date: TODAY, end_date: TODAY, reason: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = filterStatus ? { status: filterStatus } : {};
    Promise.all([getLeaves(params), getEmployees()])
      .then(([l, e]) => { setLeaves(l); setEmployees(e); })
      .catch(() => toast.error("Failed to load leaves"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createLeave({ ...form, employee_id: parseInt(form.employee_id) });
      toast.success("Leave request submitted");
      setShowAddModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit leave");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id, status) => {
    try {
      await approveLeave(id, { status });
      toast.success(`Leave ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update leave");
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: "bg-amber-900/40 text-amber-400",
      approved: "bg-emerald-900/40 text-emerald-400",
      rejected: "bg-rose-900/40 text-rose-400",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${map[status] || ""}`}>
        {status}
      </span>
    );
  };

  const columns = [
    { key: "employee_name", label: "Employee" },
    { key: "type", label: "Type", render: (r) => <span className="capitalize">{r.type}</span> },
    { key: "start_date", label: "From", render: (r) => String(r.start_date) },
    { key: "end_date", label: "To", render: (r) => String(r.end_date) },
    { key: "reason", label: "Reason", render: (r) => r.reason || "-" },
    { key: "status", label: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "actions", label: "",
      render: (r) => r.status === "pending" ? (
        <div className="flex justify-end gap-2">
          <button className="btn-soft px-3 py-1 text-xs text-emerald-400" onClick={() => handleApprove(r.id, "approved")}>Approve</button>
          <button className="btn-soft px-3 py-1 text-xs text-rose-400" onClick={() => handleApprove(r.id, "rejected")}>Reject</button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Manage employee leave requests"
        actions={<button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Request Leave</button>}
      />

      <div className="panel mb-4 flex gap-4">
        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Filter by Status</label>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? <div className="panel">Loading...</div> : (
        <DataTable columns={columns} data={leaves} searchPlaceholder="Search leaves..." />
      )}

      <Modal title="Request Leave" open={showAddModal} onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Employee *</label>
            <select className="input w-full" required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Leave Type *</label>
            <select className="input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="sick">Sick</option>
              <option value="casual">Casual</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm">Start Date *</label>
              <input className="input w-full" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm">End Date *</label>
              <input className="input w-full" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm">Reason</label>
            <textarea className="input w-full" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Submitting..." : "Submit"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
