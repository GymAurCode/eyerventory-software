import { useEffect, useState } from "react";
import { toast } from "sonner";
import { generatePayroll, getEmployees, getPayrolls } from "../../api/hr";
import { DataTable, Modal, PageHeader } from "../../components/UI";
import { formatPKR } from "../../utils/currency";

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

const STATUS_STYLE = {
  paid:    "bg-emerald-900/40 text-emerald-400",
  partial: "bg-amber-900/40 text-amber-400",
  unpaid:  "bg-rose-900/40 text-rose-400",
};

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({
    employee_id: "", month: CURRENT_MONTH, total_working_days: 26, bonus: 0,
  });
  const [saving, setSaving] = useState(false);
  const [filterEmp, setFilterEmp] = useState("");

  const load = () => {
    setLoading(true);
    const params = filterEmp ? { employee_id: filterEmp } : {};
    Promise.all([getPayrolls(params), getEmployees()])
      .then(([p, e]) => { setPayrolls(p); setEmployees(e); })
      .catch(() => toast.error("Failed to load payroll"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterEmp]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await generatePayroll({
        employee_id: parseInt(genForm.employee_id),
        month: genForm.month,
        total_working_days: parseInt(genForm.total_working_days),
        bonus: parseFloat(genForm.bonus) || 0,
      });
      toast.success("Payroll generated");
      setShowGenModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to generate payroll");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "employee_name", label: "Employee" },
    { key: "month", label: "Month" },
    { key: "base_salary", label: "Base Salary", render: (r) => formatPKR(r.base_salary) },
    { key: "present_days", label: "Present" },
    { key: "late_days", label: "Late" },
    { key: "absent_days", label: "Absent" },
    { key: "deductions", label: "Deductions", render: (r) => formatPKR(r.deductions) },
    { key: "bonus", label: "Bonus", render: (r) => formatPKR(r.bonus) },
    {
      key: "net_salary", label: "Calculated Salary",
      render: (r) => <span className="font-semibold">{formatPKR(r.net_salary)}</span>,
    },
    {
      key: "paid_amount", label: "Total Paid",
      render: (r) => <span className="text-emerald-400">{formatPKR(r.paid_amount || 0)}</span>,
    },
    {
      key: "remaining", label: "Remaining",
      render: (r) => (
        <span className={r.remaining > 0 ? "text-amber-400" : "text-emerald-400"}>
          {formatPKR(r.remaining || 0)}
        </span>
      ),
    },
    {
      key: "derived_status", label: "Status",
      render: (r) => {
        const s = r.derived_status || "unpaid";
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[s] || STATUS_STYLE.unpaid}`}>
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Salary calculations — use HR Payments tab to record actual payments"
        actions={<button className="btn-primary" onClick={() => setShowGenModal(true)}>+ Generate Payroll</button>}
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

      {/* Info banner */}
      <div className="mb-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
        Payroll is for salary calculation only. To record actual payments go to the <strong style={{ color: "var(--text-primary)" }}>HR Payments</strong> tab. Finance reports reflect only real payments.
      </div>

      {loading ? <div className="panel">Loading...</div> : (
        <DataTable columns={columns} data={payrolls} searchPlaceholder="Search payroll..." />
      )}

      <Modal title="Generate Payroll" open={showGenModal} onClose={() => setShowGenModal(false)}>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">Employee *</label>
            <select className="input w-full" required value={genForm.employee_id}
              onChange={(e) => setGenForm({ ...genForm, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.employment_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">Month *</label>
            <input className="input w-full" type="month" required value={genForm.month}
              onChange={(e) => setGenForm({ ...genForm, month: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Total Working Days *</label>
            <input className="input w-full" type="number" min="1" max="31" required
              value={genForm.total_working_days}
              onChange={(e) => setGenForm({ ...genForm, total_working_days: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Bonus</label>
            <input className="input w-full" type="number" min="0" value={genForm.bonus}
              onChange={(e) => setGenForm({ ...genForm, bonus: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-soft" onClick={() => setShowGenModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Generating..." : "Generate"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
