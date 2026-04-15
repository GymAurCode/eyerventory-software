import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";

const categories = ["Logistics", "Utilities", "Rent", "Salary", "Maintenance", "Other"];

export default function ExpensesPage() {
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ category: categories[0], amount: "", note: "", expense_date: new Date().toISOString().slice(0, 10) });

  const load = async () => {
    setLoading(true);
    const r = await api.get("/expenses");
    setRows(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount) });
      toast.success("Expense added");
      setForm({ ...form, amount: "", note: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.put(`/expenses/${selected.id}`, { ...form, amount: Number(form.amount) });
      toast.success("Expense updated");
      setEditOpen(false);
      setSelected(null);
      setForm({ category: categories[0], amount: "", note: "", expense_date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update expense");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/expenses/${deleting.id}`);
      toast.success("Expense deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete expense");
    }
  };

  useEffect(() => {
    const unsub = registerPageAction("expenses.new", () => {
      const btn = document.getElementById("add-expense-btn");
      if (btn) btn.click();
    });
    return () => unsub();
  }, [registerPageAction]);

  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" subtitle="Track operational expenses by category" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Entries" value={String(rows.length)} tone="indigo" />
        <StatCard title="Total Expense" value={rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)} tone="rose" money />
        <StatCard title="Average" value={rows.length ? rows.reduce((sum, row) => sum + Number(row.amount || 0), 0) / rows.length : 0} tone="amber" money />
      </div>

      <form className="panel grid gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={submit}>
        <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input" type="number" min="0" step="0.01" placeholder="Amount (PKR)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        <input className="input" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <input className="input" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
        <button id="add-expense-btn" className={`btn-primary ${activeActionId === "expenses.new" ? "ring-2 ring-indigo-500" : ""}`} title={`Add Expense (${formatShortcut("expenses.new")})`} disabled={submitting}>{submitting ? "Saving..." : `Add Expense (${formatShortcut("expenses.new")})`}</button>
      </form>

      {loading ? <LoadingSkeleton rows={6} /> : rows.length === 0 ? <EmptyState title="No expenses yet" description="Add an expense to build finance visibility." /> : (
        <DataTable
          data={rows}
          searchPlaceholder="Search expenses by category, date, or note..."
          searchableColumns={["category", "amount", "expense_date", "note"]}
          columns={[
            { key: "category", label: "Category" },
            { key: "amount", label: "Amount", render: (row) => formatPKR(row.amount) },
            { key: "expense_date", label: "Date" },
            { key: "note", label: "Note", render: (row) => row.note || "-" },
            {
              key: "actions",
              label: "Actions",
              align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => { setSelected(row); setViewOpen(true); }}
                  onEdit={() => { setSelected(row); setForm({ category: row.category, amount: String(row.amount), note: row.note || "", expense_date: row.expense_date }); setEditOpen(true); }}
                  onDelete={() => setDeleting(row)}
                />
              ),
            },
          ]}
        />
      )}

      <Modal title="Expense Details" open={viewOpen} onClose={() => setViewOpen(false)}>
        {selected && (
          <div className="space-y-2 text-sm">
            <p><strong>Category:</strong> {selected.category}</p>
            <p><strong>Amount:</strong> {formatPKR(selected.amount)}</p>
            <p><strong>Date:</strong> {selected.expense_date}</p>
            <p><strong>Note:</strong> {selected.note || "-"}</p>
          </div>
        )}
      </Modal>

      <Modal title="Edit Expense" open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="grid gap-3" onSubmit={submitEdit}>
          <select className="input" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} required />
          <input className="input" value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} />
          <input className="input" type="date" value={form.expense_date} onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))} required />
          <button className="btn-primary">Update Expense</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        description={`Delete expense "${deleting?.category || ""}"?`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  );
}
