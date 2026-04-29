import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createPurchase, getPurchases, getSuppliers, getProducts } from "../api/accounting";
import { ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";


function PurchaseForm({ suppliers, products, onSubmit, onClose }) {
  const [supplierId, setSupplierId] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: 1, unit_cost: "" }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItems((prev) => [...prev, { product_id: "", quantity: 1, unit_cost: "" }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) =>
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        supplier_id: supplierId ? Number(supplierId) : null,
        payment_type: paymentType,
        note: note || null,
        items: items.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Supplier</label>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Payment Type</label>
          <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} required>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Items</label>
          <button type="button" className="btn-soft px-3 py-1 text-xs" onClick={addItem}>
            <Plus size={12} className="mr-1 inline" /> Add Item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-end">
              <div>
                <label className="label text-xs">Product</label>
                <select className="input" value={item.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)} required>
                  <option value="">Select...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">Qty</label>
                <input className="input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} required />
              </div>
              <div>
                <label className="label text-xs">Unit Cost</label>
                <input className="input" type="number" min="0.01" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(i, "unit_cost", e.target.value)} required />
              </div>
              <button type="button" className="icon-btn icon-btn-danger mb-0.5" onClick={() => removeItem(i)} disabled={items.length === 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Note</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
      </div>

      <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
        <p className="font-semibold">Total: {formatPKR(total)}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Record Purchase"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);
  

  const load = () =>
    Promise.all([getPurchases(), getSuppliers(), getProducts()])
      .then(([p, s, pr]) => { setPurchases(p); setSuppliers(s); setProducts(pr); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createPurchase(data);
      toast.success("Purchase recorded");
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to record purchase");
    }
  };

  const totalCash = purchases.filter((p) => p.payment_type === "cash").reduce((s, p) => s + p.total_amount, 0);
  const totalCredit = purchases.filter((p) => p.payment_type === "credit").reduce((s, p) => s + p.total_amount, 0);

  const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  const columns = [
    { key: "id", label: "#" },
    { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: "supplier_id", label: "Supplier", render: (r) => supplierMap[r.supplier_id] || "—" },
    { key: "payment_type", label: "Type", render: (r) => (
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.payment_type === "credit" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
        {r.payment_type}
      </span>
    )},
    { key: "total_amount", label: "Total", align: "right", render: (r) => formatPKR(r.total_amount) },
    { key: "actions", label: "", render: (r) => (
      <button className="btn-soft px-3 py-1 text-xs" onClick={() => setViewPurchase(r)}>View</button>
    )},
  ];

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Inventory procurement with double-entry accounting"
        actions={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} className="mr-1 inline" />New Purchase</button>}
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard title="Total Purchases" value={purchases.length} tone="indigo" />
        <StatCard title="Cash Purchases" value={totalCash} tone="emerald" money />
        <StatCard title="Credit Purchases" value={totalCredit} tone="rose" money />
      </div>

      {purchases.length === 0
        ? <EmptyState title="No purchases yet" description="Record your first purchase to get started." />
        : <DataTable columns={columns} data={purchases} rowKey="id" searchPlaceholder="Search purchases..." />
      }

      <Modal title="New Purchase" open={showForm} onClose={() => setShowForm(false)} maxWidth="max-w-2xl">
        <PurchaseForm suppliers={suppliers} products={products} onSubmit={handleCreate} onClose={() => setShowForm(false)} />
      </Modal>

      <Modal title={`Purchase #${viewPurchase?.id}`} open={!!viewPurchase} onClose={() => setViewPurchase(null)} maxWidth="max-w-lg">
        {viewPurchase && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span style={{ color: "var(--text-secondary)" }}>Date:</span> {new Date(viewPurchase.created_at).toLocaleString()}</div>
              <div><span style={{ color: "var(--text-secondary)" }}>Type:</span> {viewPurchase.payment_type}</div>
              <div><span style={{ color: "var(--text-secondary)" }}>Supplier:</span> {supplierMap[viewPurchase.supplier_id] || "—"}</div>
              <div><span style={{ color: "var(--text-secondary)" }}>Total:</span> {formatPKR(viewPurchase.total_amount)}</div>
            </div>
            <table className="data-table w-full text-sm">
              <thead><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit Cost</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewPurchase.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{productMap[item.product_id] || item.product_id}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatPKR(item.unit_cost)}</td>
                    <td className="px-3 py-2 text-right">{formatPKR(item.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewPurchase.note && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Note: {viewPurchase.note}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

