import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { getCustomers } from "../api/accounting";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";

export default function SalesPage() {
  const { role } = useAuth();
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ product_id: "", quantity: "", selling_price: "", payment_type: "cash", customer_id: "" });
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const [s, p, c] = await Promise.all([api.get("/sales"), api.get("/products"), getCustomers()]);
    setSales(s.data);
    setProducts(p.data);
    setCustomers(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedProduct = useMemo(() => products.find((p) => p.id === Number(form.product_id)), [products, form.product_id]);
  const productOptions = useMemo(
    () => [...products].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name)),
    [products],
  );
  const total = Number(form.quantity || 0) * Number(form.selling_price || 0);
  const estimatedProfit = selectedProduct ? total - Number(form.quantity || 0) * Number(selectedProduct.cost_price || 0) : 0;
  const productNameById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name])), [products]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      product_id: Number(form.product_id),
      quantity: Number(form.quantity),
      selling_price: Number(form.selling_price),
      payment_type: form.payment_type,
      customer_id: form.payment_type === "credit" ? Number(form.customer_id) : null,
    };
    if (!payload.product_id || payload.quantity <= 0 || payload.selling_price <= 0) {
      setError("Fill all sale fields with valid values.");
      return;
    }
    if (form.payment_type === "credit" && !form.customer_id) {
      setError("Credit sales require a customer.");
      return;
    }
    if (!selectedProduct) {
      setError("Selected product not found.");
      return;
    }
    if (Number(selectedProduct.stock || 0) === 0) {
      setError("This product is out of stock. Please add stock first.");
      return;
    }
    if (payload.quantity > Number(selectedProduct.stock || 0)) {
      setError(`Only ${selectedProduct.stock} units available for this product.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/sales", payload);
      toast.success("Sale created successfully");
      setForm({ product_id: "", quantity: "", selling_price: "", payment_type: "cash", customer_id: "" });
      await load();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to create sale.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await api.put(`/sales/${selected.id}`, {
        quantity: Number(form.quantity),
        selling_price: Number(form.selling_price),
      });
      toast.success("Sale updated");
      setEditOpen(false);
      setSelected(null);
      setForm({ product_id: "", quantity: "", selling_price: "" });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update sale");
    }
  };

  const deleteSale = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/sales/${deleting.id}`);
      toast.success("Sale deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete sale");
    }
  };

  useEffect(() => {
    const unsub = registerPageAction("sales.new", () => {
      const btn = document.getElementById("create-sale-btn");
      if (btn) btn.click();
    });
    return () => unsub();
  }, [registerPageAction]);

  return (
    <div className="space-y-4">
      <PageHeader title="Sales" subtitle="Create sales and monitor transaction performance" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Transactions" value={String(sales.length)} tone="indigo" />
        <StatCard title="Total Value" value={sales.reduce((sum, item) => sum + Number(item.revenue || 0), 0)} tone="emerald" money />
        <StatCard title="Total Qty" value={String(sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0))} tone="amber" />
      </div>

      <form className="panel grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <select className="input" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
          <option value="">Select product</option>
          {productOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stock {p.stock}) {p.stock === 0 ? "- Out of stock" : ""}
            </option>
          ))}
        </select>
        <input className="input" type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <input className="input" type="number" min="0" step="0.01" placeholder="Selling price (PKR)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
        <select className="input" value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value, customer_id: "" })}>
          <option value="cash">Cash Sale</option>
          <option value="credit">Credit Sale</option>
        </select>
        {form.payment_type === "credit" && (
          <select className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required>
            <option value="">Select customer...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <button
          id="create-sale-btn"
          className={`btn-primary ${activeActionId === "sales.new" ? "ring-2 ring-indigo-500" : ""}`}
          title={`Create Sale (${formatShortcut("sales.new")})`}
          disabled={submitting || Number(selectedProduct?.stock || 0) === 0}
        >
          {submitting ? "Creating..." : `Create Sale (${formatShortcut("sales.new")})`}
        </button>
        <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
          <p>Total: <span className="font-semibold">{formatPKR(total)}</span></p>
          {role === "owner" && <p>Profit: <span className="font-semibold">{formatPKR(estimatedProfit)}</span></p>}
          {selectedProduct && Number(selectedProduct.stock || 0) === 0 && (
            <p className="mt-1 text-rose-400">Selected product is out of stock.</p>
          )}
        </div>
      </form>

      {error && <p className="rounded-lg border p-3 text-sm" style={{ borderColor: "#be123c", background: "color-mix(in srgb, #be123c 20%, var(--bg-card))", color: "var(--text-primary)" }}>{error}</p>}

      {loading ? <LoadingSkeleton rows={6} /> : (
        <DataTable
          data={sales}
          emptyText="Create a sale to see transaction history."
          searchPlaceholder="Search sales by quantity, revenue, or product id..."
          searchableColumns={["product_id", "quantity", "revenue", "profit"]}
          columns={[
            { key: "product", label: "Product", render: (row) => productNameById[row.product_id] || `#${row.product_id}` },
            { key: "quantity", label: "Qty" },
            { key: "payment_type", label: "Type", render: (row) => (
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${row.payment_type === "credit" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {row.payment_type || "cash"}
              </span>
            )},
            ...(role === "owner" ? [{ key: "revenue", label: "Revenue", render: (row) => formatPKR(row.revenue || 0) }, { key: "profit", label: "Profit", render: (row) => formatPKR(row.profit || 0) }] : []),
            {
              key: "actions",
              label: "Actions",
              align: "right",
              render: (row) => (
                <ActionButtons
                  onView={() => { setSelected(row); setViewOpen(true); }}
                  onEdit={() => { setSelected(row); setForm({ product_id: String(row.product_id), quantity: String(row.quantity), selling_price: String(row.selling_price) }); setEditOpen(true); }}
                  onDelete={() => setDeleting(row)}
                  disableEdit={role !== "owner"}
                  disableDelete={role !== "owner"}
                />
              ),
            },
          ]}
        />
      )}

      <Modal title="Sale Details" open={viewOpen} onClose={() => setViewOpen(false)}>
        {selected && (
          <div className="space-y-2 text-sm">
            <p><strong>Product:</strong> {productNameById[selected.product_id] || `#${selected.product_id}`}</p>
            <p><strong>Quantity:</strong> {selected.quantity}</p>
            <p><strong>Selling Price:</strong> {formatPKR(selected.selling_price)}</p>
            {role === "owner" && <p><strong>Revenue:</strong> {formatPKR(selected.revenue || 0)}</p>}
            {role === "owner" && <p><strong>Profit:</strong> {formatPKR(selected.profit || 0)}</p>}
          </div>
        )}
      </Modal>

      <Modal title="Edit Sale" open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="grid gap-3" onSubmit={submitEdit}>
          <input className="input" value={productNameById[Number(form.product_id)] || `#${form.product_id}`} disabled />
          <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
          <input className="input" type="number" min="1" step="0.01" value={form.selling_price} onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))} required />
          <button className="btn-primary">Update Sale</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        description={`Delete sale for ${deleting ? productNameById[deleting.product_id] || `#${deleting.product_id}` : "selected product"}?`}
        onClose={() => setDeleting(null)}
        onConfirm={deleteSale}
      />
    </div>
  );
}
