import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createPayment, getCustomers, getPayments, getSuppliers } from "../api/accounting";
import { DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";


function PaymentForm({ customers, suppliers, onSubmit, onClose }) {
  const [direction, setDirection] = useState("receive");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const isReceive = direction === "receive";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        direction,
        customer_id: isReceive ? Number(customerId) : null,
        supplier_id: !isReceive ? Number(supplierId) : null,
        amount: Number(amount),
        note: note || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Direction</label>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="receive" checked={direction === "receive"} onChange={() => setDirection("receive")} />
            <span>Receive from Customer</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" value="pay" checked={direction === "pay"} onChange={() => setDirection("pay")} />
            <span>Pay to Supplier</span>
          </label>
        </div>
      </div>

      {isReceive ? (
        <div>
          <label className="label">Customer *</label>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — Balance: {formatPKR(c.balance)}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="label">Supplier *</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Select supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — Balance: {formatPKR(s.balance)}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Amount *</label>
        <input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>

      <div>
        <label className="label">Note</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Processing..." : "Record Payment"}
        </button>
      </div>
    </form>
  );
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  

  const load = () =>
    Promise.all([getPayments(), getCustomers(), getSuppliers()])
      .then(([p, c, s]) => { setPayments(p); setCustomers(c); setSuppliers(s); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createPayment(data);
      toast.success("Payment recorded");
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    }
  };

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c.name]));
  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));

  const received = payments.filter((p) => p.direction === "receive").reduce((s, p) => s + p.amount, 0);
  const paid = payments.filter((p) => p.direction === "pay").reduce((s, p) => s + p.amount, 0);

  const columns = [
    { key: "id", label: "#" },
    { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleDateString() },
    {
      key: "direction", label: "Type",
      render: (r) => (
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.direction === "receive" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
          {r.direction === "receive" ? "Received" : "Paid"}
        </span>
      ),
    },
    {
      key: "party", label: "Party",
      render: (r) => r.direction === "receive"
        ? (customerMap[r.customer_id] || "—")
        : (supplierMap[r.supplier_id] || "—"),
    },
    { key: "amount", label: "Amount", align: "right", render: (r) => formatPKR(r.amount) },
    { key: "note", label: "Note", render: (r) => r.note || "—" },
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Settle receivables and payables"
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-1 inline" />New Payment
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard title="Total Payments" value={payments.length} tone="indigo" />
        <StatCard title="Cash Received" value={received} tone="emerald" money />
        <StatCard title="Cash Paid Out" value={paid} tone="rose" money />
      </div>

      {payments.length === 0
        ? <EmptyState title="No payments yet" description="Record a payment to settle a receivable or payable." />
        : <DataTable columns={columns} data={payments} rowKey="id" searchPlaceholder="Search payments..." />
      }

      <Modal title="New Payment" open={showForm} onClose={() => setShowForm(false)}>
        <PaymentForm customers={customers} suppliers={suppliers} onSubmit={handleCreate} onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}

