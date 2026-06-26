import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import api from "../api/client";
import { expensesApi } from "../api/expenses";
import {
  ActionButtons,
  ConfirmDialog,
  DataTable,
  EmptyState,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatCard,
} from "../components/UI";
import AddExpenseDialog from "../components/AddExpenseDialog";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString();
}

const STATUS_STYLES = {
  cash: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  bank: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  reimbursed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  credit: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const PAYMENT_METHODS = [
  { value: "", label: "All Methods" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "employee_paid", label: "Employee Paid" },
  { value: "credit", label: "Credit" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "pending", label: "Pending" },
  { value: "credit", label: "Credit" },
];

function ExpenseDetailModal({ expense, onClose }) {
  if (!expense) return null;

  const statusBadge = () => {
    if (expense.payment_method === "cash") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">CASH</span>;
    if (expense.payment_method === "bank") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-400 border-blue-500/20">BANK</span>;
    if (expense.payment_method === "employee_paid" && !expense.reimbursement_pending) return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">REIMBURSED</span>;
    if (expense.payment_method === "employee_paid" && expense.reimbursement_pending) return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border-amber-500/20">PENDING</span>;
    if (expense.payment_method === "credit") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border-rose-500/20">CREDIT</span>;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-xl border shadow-2xl"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-base font-semibold">{expense.voucher_no || `Expense #${expense.id}`}</h3>
            <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              {formatDate(expense.expense_date)} {statusBadge()}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {expense.employee_name && <p className="text-sm"><strong>Employee:</strong> {expense.employee_name}</p>}
          {expense.remarks && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{expense.remarks}</p>}

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Expense Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Description</th>
                  <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(expense.items || []).map((it) => (
                  <tr key={it.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-3 py-2">{it.expense_type}</td>
                    <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{it.description || "-"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatPKR(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Payment: <strong className="capitalize">{expense.payment_method?.replace("_", " ")}</strong></span>
            <span className="text-base font-bold">{formatPKR(expense.total_amount)}</span>
          </div>

          {expense.vehicle && (
            <div className="rounded-lg border p-3 text-sm space-y-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
              <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                <i className="ti ti-truck" /> Vehicle Details
              </p>
              <p><strong>Vehicle:</strong> {expense.vehicle.vehicle_name} ({expense.vehicle.vehicle_type})</p>
              {expense.vehicle.driver_name && <p><strong>Driver:</strong> {expense.vehicle.driver_name}</p>}
              {expense.vehicle.trip_purpose && <p><strong>Purpose:</strong> {expense.vehicle.trip_purpose}</p>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ExpensesPage() {
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    expenseType: "",
    employeeName: "",
    paymentMethod: "",
    status: "",
    vehicleOnly: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await expensesApi.list();
      setRows(data);
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const unsub = registerPageAction("expenses.new", () => setShowForm(true));
    return () => unsub();
  }, [registerPageAction]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.dateFrom && row.expense_date < filters.dateFrom) return false;
      if (filters.dateTo && row.expense_date > filters.dateTo) return false;
      if (filters.expenseType) {
        const hasType = (row.items || []).some((it) => it.expense_type === filters.expenseType);
        if (!hasType) return false;
      }
      if (filters.employeeName) {
        const q = filters.employeeName.toLowerCase();
        if (!(row.employee_name || "").toLowerCase().includes(q)) return false;
      }
      if (filters.paymentMethod && row.payment_method !== filters.paymentMethod) return false;
      if (filters.status === "reimbursed" && !(row.payment_method === "employee_paid" && !row.reimbursement_pending)) return false;
      if (filters.status === "pending" && !(row.payment_method === "employee_paid" && row.reimbursement_pending)) return false;
      if (filters.status === "cash" && row.payment_method !== "cash") return false;
      if (filters.status === "bank" && row.payment_method !== "bank") return false;
      if (filters.status === "credit" && row.payment_method !== "credit") return false;
      if (filters.vehicleOnly) {
        const hasVehicle = (row.items || []).some((it) =>
          ["Petrol / Fuel", "Vehicle Maintenance", "Toll / Parking"].includes(it.expense_type)
        );
        if (!hasVehicle) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await expensesApi.delete(deleting.id);
      toast.success("Expense deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete expense");
    } finally {
      setDeletingLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = filteredRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    return { count: filteredRows.length, total };
  }, [filteredRows]);

  const statusRender = (row) => {
    if (row.payment_method === "cash") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">CASH</span>;
    if (row.payment_method === "bank") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-400 border-blue-500/20">BANK</span>;
    if (row.payment_method === "employee_paid" && !row.reimbursement_pending) return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/20">REIMBURSED</span>;
    if (row.payment_method === "employee_paid" && row.reimbursement_pending) return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400 border-amber-500/20">PENDING</span>;
    if (row.payment_method === "credit") return <span className="rounded border px-2 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-400 border-rose-500/20">CREDIT</span>;
    return <span className="capitalize">{row.payment_method}</span>;
  };

  const hasVehicleIcon = (row) => {
    return (row.items || []).some((it) =>
      ["Petrol / Fuel", "Vehicle Maintenance", "Toll / Parking"].includes(it.expense_type)
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        subtitle="Manage operational expenses with accounting integration"
        actions={
          <button
            id="add-expense-btn"
            onClick={() => setShowForm(true)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ${activeActionId === "expenses.new" ? "ring-2 ring-indigo-500" : ""}`}
            style={{ background: "var(--accent)" }}
            title={`Add Expense (${formatShortcut("expenses.new")})`}
          >
            <Plus size={15} /> Add Expense ({formatShortcut("expenses.new")})
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Entries" value={stats.count} tone="indigo" icon="ti-file-text" />
        <StatCard title="Total Expense" value={stats.total} tone="rose" money icon="ti-currency-dollar" />
        <StatCard title="Average" value={stats.count ? stats.total / stats.count : 0} tone="amber" money icon="ti-calculator" />
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Date From</label>
            <input type="date" className="input py-2" value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Date To</label>
            <input type="date" className="input py-2" value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Expense Type</label>
            <input className="input py-2" placeholder="Filter by type…" value={filters.expenseType}
              onChange={(e) => setFilters((f) => ({ ...f, expenseType: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Employee</label>
            <input className="input py-2" placeholder="Employee name…" value={filters.employeeName}
              onChange={(e) => setFilters((f) => ({ ...f, employeeName: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Payment</label>
            <div className="relative">
              <select className="input py-2 pr-8 appearance-none" value={filters.paymentMethod}
                onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
            <div className="relative">
              <select className="input py-2 pr-8 appearance-none" value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
            </div>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={filters.vehicleOnly}
                onChange={(e) => setFilters((f) => ({ ...f, vehicleOnly: e.target.checked }))}
                className="rounded border-gray-600" />
              Vehicle only
            </label>
          </div>
          <button className="btn-soft py-2 text-sm" onClick={() => setFilters({ dateFrom: "", dateTo: "", expenseType: "", employeeName: "", paymentMethod: "", status: "", vehicleOnly: false })}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : filteredRows.length === 0 ? (
        <EmptyState title="No expenses found" description={rows.length === 0 ? "Add an expense to get started." : "Try adjusting your filters."} />
      ) : (
        <DataTable
          data={filteredRows}
          searchPlaceholder="Search expenses by voucher, employee, or type..."
          searchableColumns={["voucher_no", "employee_name", "remarks"]}
          columns={[
            { key: "expense_date", label: "Date", render: (row) => formatDate(row.expense_date) },
            { key: "voucher_no", label: "Voucher No", render: (row) => row.voucher_no || `#${row.id}` },
            {
              key: "employee_name",
              label: "Employee",
              render: (row) => (
                <span className="flex items-center gap-1">
                  {row.employee_name || "-"}
                  {hasVehicleIcon(row) && <i className="ti ti-truck text-xs" style={{ color: "var(--accent)" }} title="Vehicle expense" />}
                </span>
              ),
            },
            {
              key: "items",
              label: "Items",
              render: (row) => (row.items || []).length,
            },
            {
              key: "total_amount",
              label: "Total (PKR)",
              render: (row) => formatPKR(row.total_amount),
            },
            {
              key: "payment_method",
              label: "Payment",
              render: (row) => (
                <span className="capitalize text-xs">{row.payment_method?.replace("_", " ")}</span>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: statusRender,
            },
            {
              key: "actions",
              label: "Actions",
              align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => setDetail(row)}
                  onPrint={() => printRecord({
                    title: `Expense — ${row.voucher_no || `#${row.id}`}`,
                    fields: [
                      { label: "Date", value: formatDate(row.expense_date) },
                      { label: "Voucher No", value: row.voucher_no || "-" },
                      { label: "Employee", value: row.employee_name || "-" },
                      { label: "Total", value: formatPKR(row.total_amount) },
                      { label: "Payment", value: row.payment_method?.replace("_", " ") },
                      { label: "Remarks", value: row.remarks || "-" },
                      ...(row.items || []).flatMap((it) => [
                        { label: "Item", value: `${it.expense_type} — ${formatPKR(it.amount)}${it.description ? ` (${it.description})` : ""}` },
                      ]),
                    ],
                  })}
                  onDelete={() => setDeleting(row)}
                />
              ),
            },
          ]}
        />
      )}

      {/* Add Expense Dialog */}
      <AddExpenseDialog open={showForm} onClose={() => setShowForm(false)} onSaved={load} />

      {/* Detail Modal */}
      {detail && <ExpenseDetailModal expense={detail} onClose={() => setDetail(null)} />}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleting}
        description={`Delete expense "${deleting?.voucher_no || `#${deleting?.id}`}"? This will remove the journal entry too.`}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deletingLoading}
      />
    </div>
  );
}
