import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createHRPayment, getEmployees, getHRPayments, getPayrolls, reversePayment } from "../../api/hr";
import { DataTable, Modal, PageHeader } from "../../components/UI";
import { formatPKR } from "../../utils/currency";

const TODAY = new Date().toISOString().slice(0, 10);

export default function HRPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [filterEmp, setFilterEmp] = useState("");
  const [addForm, setAddForm] = useState({ employee_id: "", payroll_id: "", amount: "", date: TODAY, method: "cash", note: "" });
  const [reverseForm, setReverseForm] = useState({ reason: "", admin_password: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = filterEmp ? { employee_id: filterEmp } : {};
    Promise.all([getHRPayments(params), getEmployees(), getPayrolls()])
      .then(([p, e, pr]) => { setPayments(p); setEmployees(e); setPayrolls(pr); })
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterEmp]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createHRPayment({
        employee_id: parseInt(addForm.employee_id),
        payroll_id: addForm.payroll_id ? parseInt(addForm.payroll_id) : null,
        amount: parseFloat(addForm.amount),
        date: addForm.date,
        method: addForm.method,
        note: addForm.note || null,
      });
      toast.success("Payment recorded");
      setShowAddModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const handleReverse = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await reversePayment({ payment_id: selectedPayment.id, ...reverseForm });
      toast.success("Payment reversed");
      setShowReverseModal(false);
      setReverseForm({ reason: "", admin_password: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Reversal failed");
    } finally {
      setSaving(false);
    }
  };

  const empPayrolls = payrolls.filter((p) => p.employee_id === parseInt(addForm.employee_id));

  const columns = [
    { key: "employee_name", label: "Employee" },
    { key: "amount", label: "Amount", render: (r) => formatPKR(r.amount) },
    { key: "date", label: "Date" },
    { key: "method", label: "Method", render: (r) => <span className="capitalize">{r.method}</span> },
    { key: "note", label: "Note", render: (r) => r.note || "-" },
    {
      key: "is_reversed", label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.is_reversed ? "bg-rose-900/40 text-rose-400" : "bg-emerald-900/40 text-emerald-400"}`}>
          {r.is_reversed ? "Reversed" : "Active"}
        </span>
      ),
    },
    {
      key: "actions", label: "",
      render: (r) => !r.is_reversed ? (
        <button className="btn-soft px-3 py-1 text-xs text-rose-400" onClick={() => { setSelectedPayment(r); setShowReverseModal(true); }}>
          Reverse
        </button>
      ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="HR Payments"
        subtitle="Track salary payments and reversals"
        actions={<button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Payment</button>}
      />

      <div className="panel mb-4 flex gap-4">
        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Filter by Employee</label>
          <select className="input" value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="panel">Loading...</div> : (
        <DataTable columns={columns} data={payments} searchPlaceholder="Search payments..." />
      )}

      {/* Add Payment Modal */}
      <Modal title="Add Payment" open={showAddModal} onClose={() => setShowAddModal(false)}>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Employee *</label>
            <select className="input w-full" required value={addForm.employee_id} onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value, payroll_id: "" })}>
              <option value="">Select employee</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          {empPayrolls.length > 0 && (
            <div>
              <label className="mb-1 block text-sm">Link to Payroll (optional)</label>
              <select className="input w-full" value={addForm.payroll_id} onChange={(e) => setAddForm({ ...addForm, payroll_id: e.target.value })}>
                <option value="">None</option>
                {empPayrolls.map((p) => <option key={p.id} value={p.id}>{p.month} — Net: {formatPKR(p.net_salary)} — Remaining: {formatPKR(p.remaining)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm">Amount *</label>
            <input className="input w-full" type="number" min="1" required value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Date *</label>
            <input className="input w-full" type="date" required value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Method *</label>
            <select className="input w-full" value={addForm.method} onChange={(e) => setAddForm({ ...addForm, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Note</label>
            <input className="input w-full" value={addForm.note} onChange={(e) => setAddForm({ ...addForm, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </Modal>

      {/* Reverse Payment Modal */}
      <Modal title="Reverse Payment" open={showReverseModal} onClose={() => setShowReverseModal(false)}>
        {selectedPayment && (
          <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--bg-elevated)" }}>
            <p>Employee: {selectedPayment.employee_name}</p>
            <p>Amount: {formatPKR(selectedPayment.amount)}</p>
            <p>Date: {selectedPayment.date}</p>
          </div>
        )}
        <form onSubmit={handleReverse} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Reason *</label>
            <input className="input w-full" required value={reverseForm.reason} onChange={(e) => setReverseForm({ ...reverseForm, reason: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Admin Password *</label>
            <input className="input w-full" type="password" required value={reverseForm.admin_password} onChange={(e) => setReverseForm({ ...reverseForm, admin_password: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setShowReverseModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Reversing..." : "Confirm Reversal"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
