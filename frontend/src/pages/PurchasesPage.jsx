<<<<<<< HEAD
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, ChevronDown, Eye } from "lucide-react";
import { toast } from "sonner";
import api from "../api/client";
import { purchasesApi } from "../api/purchases";
import { PageHeader } from "../components/UI";
import { formatPKR } from "../utils/currency";

// ─── helpers ────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyItem() {
  return { product_id: "", quantity: "", purchase_price: "" };
}

// ─── sub-components ─────────────────────────────────────────────────────────

function Select({ label, value, onChange, children, required }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}{required && " *"}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className="w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
        >
          {children}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
      </div>
    </div>
  );
}

function Input({ label, required, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}{required && " *"}</label>}
      <input
        {...props}
        className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
      />
    </div>
  );
}

// ─── Purchase Form Modal ─────────────────────────────────────────────────────

function PurchaseFormModal({ open, onClose, suppliers, products, onSaved }) {
  const showToast = (msg, type) => type === "error" ? toast.error(msg) : toast.success(msg);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplier_id: "",
    invoice_number: "",
    purchase_date: today(),
    discount: "0",
    tax: "0",
    payment_type: "CASH",
    notes: "",
  });

  const [items, setItems] = useState([emptyItem()]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm({ supplier_id: "", invoice_number: "", purchase_date: today(), discount: "0", tax: "0", payment_type: "CASH", notes: "" });
      setItems([emptyItem()]);
    }
  }, [open]);

  // ── totals (derived, no state) ──
  const subtotal = items.reduce((sum, it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.purchase_price) || 0;
    return sum + q * p;
  }, 0);
  const discount = parseFloat(form.discount) || 0;
  const tax = parseFloat(form.tax) || 0;
  const finalAmount = subtotal - discount + tax;

  // ── item handlers ──
  const setItemField = useCallback((idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }, []);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // ── submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) return showToast("Select a supplier", "error");
    if (items.some((it) => !it.product_id || !it.quantity || !it.purchase_price)) {
      return showToast("Fill all item fields", "error");
    }

    setSaving(true);
    try {
      await purchasesApi.create({
        supplier_id: parseInt(form.supplier_id),
        invoice_number: form.invoice_number.trim(),
        purchase_date: new Date(form.purchase_date).toISOString(),
        discount: parseFloat(form.discount) || 0,
        tax: parseFloat(form.tax) || 0,
        payment_type: form.payment_type,
        notes: form.notes || null,
        items: items.map((it) => ({
          product_id: parseInt(it.product_id),
          quantity: parseInt(it.quantity),
          purchase_price: parseFloat(it.purchase_price),
        })),
      });
      showToast("Purchase saved successfully", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to save purchase", "error");
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    } finally {
      setSaving(false);
    }
  };

<<<<<<< HEAD
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10" style={{ background: "rgba(0,0,0,0.5)" }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="w-full max-w-3xl rounded-xl border shadow-2xl"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="text-base font-semibold">New Purchase</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Supplier" required value={form.supplier_id} onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Invoice Number" required placeholder="INV-001" value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Purchase Date" required type="date" value={form.purchase_date} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
            <Select label="Payment Type" required value={form.payment_type} onChange={(e) => setForm((f) => ({ ...f, payment_type: e.target.value }))}>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit (Accounts Payable)</option>
            </Select>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Line Items</span>
              <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                <Plus size={12} /> Add Row
              </button>
            </div>

            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Product</th>
                    <th className="px-3 py-2 text-right text-xs font-medium w-24" style={{ color: "var(--text-secondary)" }}>Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium w-32" style={{ color: "var(--text-secondary)" }}>Price</th>
                    <th className="px-3 py-2 text-right text-xs font-medium w-28" style={{ color: "var(--text-secondary)" }}>Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <ItemRow
                      key={idx}
                      item={item}
                      products={products}
                      onChange={(field, val) => setItemField(idx, field, val)}
                      onRemove={() => removeItem(idx)}
                      canRemove={items.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discount / Tax / Notes */}
          <div className="grid grid-cols-3 gap-4">
            <Input label="Discount" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
            <Input label="Tax" type="number" min="0" step="0.01" value={form.tax} onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))} />
            <Input label="Notes" placeholder="Optional…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* Totals */}
          <div className="rounded-lg border p-4 space-y-1.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
            <TotalRow label="Subtotal" value={subtotal} />
            <TotalRow label="Discount" value={-discount} />
            <TotalRow label="Tax" value={tax} />
            <div className="border-t pt-2 mt-2" style={{ borderColor: "var(--border-color)" }}>
              <TotalRow label="Final Amount" value={finalAmount} bold />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-soft">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {saving ? "Saving…" : "Save Purchase"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ItemRow({ item, products, onChange, onRemove, canRemove }) {
  const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.purchase_price) || 0);

  return (
    <tr className="border-t" style={{ borderColor: "var(--border-color)" }}>
      <td className="px-3 py-2">
        <div className="relative">
          <select
            value={item.product_id}
            onChange={(e) => onChange("product_id", e.target.value)}
            className="w-full appearance-none rounded border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
            style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <option value="">Select…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onChange("quantity", e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          placeholder="0"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={item.purchase_price}
          onChange={(e) => onChange("purchase_price", e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          placeholder="0.00"
        />
      </td>
      <td className="px-3 py-2 text-right text-sm font-medium">{formatPKR(lineTotal)}</td>
      <td className="px-2 py-2 text-center">
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded p-1 hover:bg-red-500/10 text-red-400">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}

function TotalRow({ label, value, bold }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "font-semibold text-base" : ""}`}>
      <span style={{ color: bold ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</span>
      <span>{formatPKR(value)}</span>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function PurchaseDetailModal({ purchase, onClose }) {
  if (!purchase) return null;
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
            <h3 className="text-base font-semibold">Purchase #{purchase.invoice_number}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{purchase.supplier_name} · {purchase.payment_type}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--bg-hover)]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-secondary)" }}>
                <th className="pb-2 text-left font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.items.map((it) => (
                <tr key={it.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                  <td className="py-1.5">{it.product_name || `Product #${it.product_id}`}</td>
                  <td className="py-1.5 text-right">{it.quantity}</td>
                  <td className="py-1.5 text-right">{formatPKR(it.purchase_price)}</td>
                  <td className="py-1.5 text-right">{formatPKR(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t pt-3 space-y-1" style={{ borderColor: "var(--border-color)" }}>
            <TotalRow label="Subtotal" value={purchase.total_amount} />
            <TotalRow label="Discount" value={-purchase.discount} />
            <TotalRow label="Tax" value={purchase.tax} />
            <TotalRow label="Final Amount" value={purchase.final_amount} bold />
          </div>
          {purchase.notes && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Notes: {purchase.notes}</p>}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const showToast = (msg, type) => type === "error" ? toast.error(msg) : toast.success(msg);
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
<<<<<<< HEAD
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, s, pr] = await Promise.all([
        purchasesApi.list(),
        api.get("/suppliers").then((r) => r.data),
        api.get("/products").then((r) => r.data),
      ]);
      setPurchases(p);
      setSuppliers(s);
      setProducts(pr);
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this purchase? This cannot be undone.")) return;
    try {
      await purchasesApi.delete(id);
      showToast("Purchase deleted", "success");
      load();
    } catch {
      showToast("Failed to delete purchase", "error");
    }
  };

=======
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

>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
  return (
    <div>
      <PageHeader
        title="Purchases"
<<<<<<< HEAD
        subtitle="Manage supplier purchases with full accounting integration"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            <Plus size={15} /> New Purchase
          </button>
        }
      />

      {loading ? (
        <div className="panel text-center text-sm" style={{ color: "var(--text-secondary)" }}>Loading…</div>
      ) : purchases.length === 0 ? (
        <div className="panel text-center">
          <p className="font-semibold">No purchases yet</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Click "New Purchase" to record your first purchase.</p>
        </div>
      ) : (
        <div className="panel overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-center font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t hover:bg-[var(--bg-hover)] transition-colors" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-4 py-3 font-medium">{p.invoice_number}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{p.supplier_name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{new Date(p.purchase_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: p.payment_type === "CASH" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                        color: p.payment_type === "CASH" ? "#10b981" : "#f59e0b",
                      }}
                    >
                      {p.payment_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPKR(p.final_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setDetail(p)} className="rounded p-1.5 hover:bg-[var(--bg-elevated)]" title="View details">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="rounded p-1.5 hover:bg-red-500/10 text-red-400" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <PurchaseFormModal
            open={showForm}
            onClose={() => setShowForm(false)}
            suppliers={suppliers}
            products={products}
            onSaved={load}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detail && <PurchaseDetailModal purchase={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}
=======
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

>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
