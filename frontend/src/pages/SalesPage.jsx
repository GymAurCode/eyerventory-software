import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { posApi } from "../api/pos";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";

function ViewSaleModal({ sale, open, onClose }) {
  if (!sale) return null;
  return (
    <Modal title={`Sale #${sale.bill_number}`} open={open} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span><strong>Bill#:</strong> {sale.bill_number}</span>
          <span style={{ color: "var(--text-secondary)" }}>{new Date(sale.created_at).toLocaleString()}</span>
        </div>
        {sale.customer && <p><strong>Customer:</strong> {sale.customer.name}</p>}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--bg-elevated)" }}>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item) => (
                <tr key={item.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-3 py-1.5">{item.item_name}</td>
                  <td className="px-3 py-1.5 text-center">{item.qty}</td>
                  <td className="px-3 py-1.5 text-right">{formatPKR(item.unit_price)}</td>
                  <td className="px-3 py-1.5 text-right">{formatPKR(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 text-right">
          <p>Subtotal: {formatPKR(sale.subtotal)}</p>
          {sale.discount > 0 && <p>Discount: -{formatPKR(sale.discount)}</p>}
          <p className="font-bold text-base">Total: {formatPKR(sale.total)}</p>
        </div>
        <div className="flex justify-between border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
          <span><strong>Payment:</strong> {sale.payment_method}</span>
          <span><strong>Status:</strong> <StatusBadge status={sale.status} /></span>
        </div>
        {sale.cash_received != null && (
          <p>Cash: {formatPKR(sale.cash_received)} | Change: {formatPKR(sale.change_amount)}</p>
        )}
      </div>
    </Modal>
  );
}

function StatusBadge({ status }) {
  if (status === "completed") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400">Completed</span>;
  if (status === "returned") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-400">Returned</span>;
  if (status === "partial_return") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-400">Partial Return</span>;
  return <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--bg-elevated)" }}>{status}</span>;
}

function ReturnModal({ sale, open, onClose, onDone }) {
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sale) {
      setReturnItems(
        sale.items.map((i) => ({
          item_id: i.item_id,
          item_name: i.item_name,
          maxQty: i.qty,
          qty: 0,
          unit_price: i.unit_price,
        }))
      );
      setReason("");
    }
  }, [sale]);

  const toggleItem = (itemId, checked) => {
    setReturnItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, qty: checked ? i.maxQty : 0 } : i))
    );
  };

  const setQty = (itemId, qty) => {
    setReturnItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? { ...i, qty: Math.min(Math.max(0, qty), i.maxQty) } : i))
    );
  };

  const totalRefund = useMemo(
    () => returnItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0),
    [returnItems]
  );

  const handleSubmit = async () => {
    const items = returnItems.filter((i) => i.qty > 0);
    if (items.length === 0) { toast.error("Select at least one item to return"); return; }
    setSubmitting(true);
    try {
      await posApi.returnSale(sale.id, {
        items: items.map((i) => ({ item_id: i.item_id, qty: i.qty })),
        reason: reason || null,
      });
      toast.success(`Return processed — refund ${formatPKR(totalRefund)}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Return failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <Modal title={`Return — ${sale.bill_number}`} open={open} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-3 text-sm">
        <p style={{ color: "var(--text-secondary)" }}>Select items to return. Stock will be restored.</p>
        {returnItems.map((item) => (
          <div key={item.item_id} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
            <input
              type="checkbox"
              className="w-4 h-4 accent-teal-500"
              checked={item.qty > 0}
              onChange={(e) => toggleItem(item.item_id, e.target.checked)}
            />
            <span className="flex-1">{item.item_name}</span>
            {item.qty > 0 ? (
              <input
                className="input w-16 text-xs py-0.5 text-center"
                type="number"
                min="1"
                max={item.maxQty}
                value={item.qty}
                onChange={(e) => setQty(item.item_id, parseInt(e.target.value) || 0)}
              />
            ) : (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>qty: {item.maxQty}</span>
            )}
          </div>
        ))}
        <div>
          <label className="text-xs" style={{ color: "var(--text-secondary)" }}>Reason (optional)</label>
          <input className="input mt-1 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, wrong item..." />
        </div>
        <div className="flex justify-between font-semibold border-t pt-2" style={{ borderColor: "var(--border-color)" }}>
          <span>Total Refund</span>
          <span className="text-rose-400">{formatPKR(totalRefund)}</span>
        </div>
        <button className="btn-primary w-full" disabled={submitting || totalRefund <= 0} onClick={handleSubmit}>
          {submitting ? "Processing..." : `Process Return (${formatPKR(totalRefund)})`}
        </button>
      </div>
    </Modal>
  );
}

export default function SalesPage() {
  const { role } = useAuth();
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();

  // Tab state
  const [tab, setTab] = useState("pos");

  // POS Sales state
  const [posSales, setPosSales] = useState([]);
  const [posLoading, setPosLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [returnOpen, setReturnOpen] = useState(false);

  // Legacy sales state
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({
    product_id: "",
    customer_id: "",
    quantity: "",
    selling_price: "",
    payment_type: "CASH",
    paid_amount: "",
    due_date: "",
  });
  const [error, setError] = useState("");

  // ── POS Sales methods ──────────────────────────────────────────────────
  const loadPosSales = async () => {
    setPosLoading(true);
    try {
      const data = await posApi.listSales();
      setPosSales(data);
    } catch { /* backend not ready */ }
    setPosLoading(false);
  };

  // ── Legacy sales methods ───────────────────────────────────────────────
  const loadLegacy = async () => {
    setLoading(true);
    const [s, p, c] = await Promise.all([api.get("/sales"), api.get("/products"), api.get("/customers")]);
    setSales(s.data);
    setProducts(p.data);
    setCustomers(c.data);
    setLoading(false);
  };

  useEffect(() => {
    loadPosSales();
    loadLegacy();
  }, []);

  const selectedProduct = useMemo(() => products.find((p) => p.id === Number(form.product_id)), [products, form.product_id]);
  const productOptions = useMemo(
    () => [...products].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name)),
    [products],
  );
  const legacyTotal = Number(form.quantity || 0) * Number(form.selling_price || 0);
  const estimatedProfit = selectedProduct ? legacyTotal - Number(form.quantity || 0) * Number(selectedProduct.cost_price || 0) : 0;
  const productNameById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name])), [products]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      product_id: Number(form.product_id),
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      quantity: Number(form.quantity),
      selling_price: Number(form.selling_price),
      payment_type: form.payment_type,
      paid_amount: form.paid_amount ? Number(form.paid_amount) : 0,
      due_date: form.due_date || null,
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
    if (payload.payment_type === "CREDIT" && !payload.customer_id) {
      setError("Customer is required for credit sale.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/sales", payload);
      toast.success("Sale created successfully");
      setForm({ product_id: "", customer_id: "", quantity: "", selling_price: "", payment_type: "CASH", paid_amount: "", due_date: "" });
      await loadLegacy();
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
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        quantity: Number(form.quantity),
        selling_price: Number(form.selling_price),
        payment_type: form.payment_type,
        paid_amount: form.paid_amount ? Number(form.paid_amount) : 0,
        due_date: form.due_date || null,
      });
      toast.success("Sale updated");
      setEditOpen(false);
      setSelected(null);
      setForm({ product_id: "", customer_id: "", quantity: "", selling_price: "", payment_type: "CASH", paid_amount: "", due_date: "" });
      await loadLegacy();
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
      await loadLegacy();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete sale");
    }
  };

  // ── POS Table Columns ──────────────────────────────────────────────────
  const posColumns = [
    { key: "bill_number", label: "Bill#" },
    {
      key: "created_at", label: "Date",
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "customer", label: "Customer",
      render: (row) => row.customer?.name || "Walk-in",
    },
    {
      key: "items", label: "Items",
      render: (row) => row.items?.length || 0,
    },
    {
      key: "total", label: "Total",
      render: (row) => formatPKR(row.total),
    },
    {
      key: "payment_method", label: "Payment",
      render: (row) => (
        <span className="capitalize">{row.payment_method}</span>
      ),
    },
    {
      key: "status", label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions", label: "Actions", align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button className="icon-btn icon-btn-view" onClick={async () => {
            try {
              const full = await posApi.getSale(row.id);
              setSelected(full);
              setViewOpen(true);
            } catch { toast.error("Failed to load sale"); }
          }} title="View Details">
            <i className="ti ti-eye" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-print" onClick={() => printBrowserReceipt(row)} title="Print Receipt">
            <i className="ti ti-printer" style={{ fontSize: "16px" }} />
          </button>
          {(row.status === "completed" || row.status === "partial_return") && (
            <button className="icon-btn icon-btn-edit" onClick={async () => {
              try {
                const full = await posApi.getSale(row.id);
                setSelected(full);
                setReturnOpen(true);
              } catch { toast.error("Failed to load sale"); }
            }} title="Return Items">
              <i className="ti ti-receipt-refund" style={{ fontSize: "16px" }} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const printBrowserReceipt = (sale) => {
    const w = window.open("", "Receipt", "width=400,height=600");
    if (!w) return;
    const itemRows = (sale.items || []).map((i) =>
      `<tr><td>${i.item_name} x${i.qty}</td><td style="text-align:right">${formatPKR(i.total_price)}</td></tr>`
    ).join("");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Receipt</title>
      <style>
        @media print { body * { visibility: hidden; } #receipt, #receipt * { visibility: visible; } #receipt { position: absolute; top: 0; left: 0; width: 8cm; padding: 8px; } }
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 8px; }
        #receipt { width: 8cm; margin: 0 auto; }
        h2, h3 { text-align: center; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 4px; }
        .line { border-top: 1px dashed #000; }
        .total { font-weight: bold; font-size: 14px; }
        .center { text-align: center; }
      </style></head><body>
      <div id="receipt">
        <h2>EYERFLOW OPTICAL</h2>
        <p class="center">Phone: 0300-0000000</p>
        <hr/>
        <p>Date: ${new Date(sale.created_at).toLocaleDateString()} | Bill#: ${sale.bill_number}</p>
        ${sale.customer?.name ? `<p>Customer: ${sale.customer.name}</p>` : ""}
        <hr/>
        <table>${itemRows}</table>
        <hr/>
        <p style="text-align:right">Subtotal: ${formatPKR(sale.subtotal)}</p>
        ${sale.discount > 0 ? `<p style="text-align:right">Discount: -${formatPKR(sale.discount)}</p>` : ""}
        <p class="total" style="text-align:right">TOTAL: ${formatPKR(sale.total)}</p>
        <p style="text-align:right">Payment: ${sale.payment_method}</p>
        <hr/>
        <p class="center">Thank you for visiting!</p>
      </div>
      <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
    w.document.close();
  };

  // ── Shortcuts ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = registerPageAction("sales.new", () => {
      const btn = document.getElementById("create-sale-btn");
      if (btn) btn.click();
    });
    return () => unsub();
  }, [registerPageAction]);

  // ── POS Summary ────────────────────────────────────────────────────────
  const posTotalRevenue = useMemo(() => posSales.reduce((s, r) => s + r.total, 0), [posSales]);
  const posTransactionCount = posSales.length;
  const returnedCount = posSales.filter((s) => s.status === "returned" || s.status === "partial_return").length;

  // ── Legacy Summary ─────────────────────────────────────────────────────
  const legacyTotalRevenue = useMemo(() => sales.reduce((sum, item) => sum + Number(item.revenue || 0), 0), [sales]);
  const legacyTotalQty = useMemo(() => sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [sales]);

  return (
    <div className="space-y-4">
      <PageHeader title="Sales" subtitle="Manage POS and legacy sales transactions" />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1 flex-wrap" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}>
        {[
          { id: "pos", label: "POS Sales" },
          { id: "legacy", label: "Legacy Sales" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
            style={
              tab === t.id
                ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                : { background: "transparent", color: "var(--text-secondary)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pos" ? (
        <>
          {/* POS Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Transactions" value={posTransactionCount} tone="indigo" icon="ti-receipt" />
            <StatCard title="Total Revenue" value={posTotalRevenue} tone="emerald" money icon="ti-currency-dollar" />
            <StatCard title="Returns" value={returnedCount} tone="rose" icon="ti-receipt-refund" />
          </div>

          {posLoading ? <LoadingSkeleton rows={6} /> : posSales.length === 0 ? (
            <EmptyState title="No POS sales yet" description="Start a sale from the POS / Billing page." />
          ) : (
            <DataTable
              columns={posColumns}
              data={posSales}
              searchPlaceholder="Search by bill number..."
              searchableColumns={["bill_number"]}
            />
          )}

          <ViewSaleModal sale={selected} open={viewOpen} onClose={() => { setViewOpen(false); setSelected(null); }} />
          <ReturnModal
            sale={selected}
            open={returnOpen}
            onClose={() => { setReturnOpen(false); setSelected(null); }}
            onDone={() => { loadPosSales(); }}
          />
        </>
      ) : (
        <>
          {/* Legacy Sales */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Transactions" value={sales.length} tone="indigo" icon="ti-receipt" />
            <StatCard title="Total Value" value={legacyTotalRevenue} tone="emerald" money icon="ti-currency-dollar" />
            <StatCard title="Total Qty" value={legacyTotalQty} tone="amber" icon="ti-shopping-cart" />
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
            <select className="input" value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })}>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
            </select>
            <select className="input" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="input" type="number" min="0" step="0.01" placeholder="Selling price (PKR)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
            <input className="input" type="number" min="0" step="0.01" placeholder="Paid amount" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
            <input className="input" type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <button
              id="create-sale-btn"
              className={`btn-primary ${activeActionId === "sales.new" ? "ring-2 ring-indigo-500" : ""}`}
              title={`Create Sale (${formatShortcut("sales.new")})`}
              disabled={submitting || Number(selectedProduct?.stock || 0) === 0}
            >
              {submitting ? "Creating..." : `Create Sale (${formatShortcut("sales.new")})`}
            </button>
            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
              <p>Total: <span className="font-semibold">{formatPKR(legacyTotal)}</span></p>
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
              searchableColumns={["product_id", "customer_id", "quantity", "revenue", "payment_type", "due_amount", "status"]}
              columns={[
                { key: "product", label: "Product", render: (row) => productNameById[row.product_id] || `#${row.product_id}` },
                { key: "paid_amount", label: "Paid", render: (row) => formatPKR(row.paid_amount || 0) },
                { key: "due_amount", label: "Remaining", render: (row) => formatPKR(row.due_amount || 0) },
                { key: "quantity", label: "Qty" },
                { key: "payment_type", label: "Type", render: (row) => (
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${row.payment_type === "credit" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                    {row.payment_type || "cash"}
                  </span>
                )},
                ...(role === "owner" ? [{ key: "revenue", label: "Revenue", render: (row) => formatPKR(row.revenue || 0) }, { key: "profit", label: "Profit", render: (row) => formatPKR(row.profit || 0) }] : []),
                {
                  key: "actions", label: "Actions", align: "right",
                  render: (row) => (
                    <ActionButtons
                      onView={() => { setSelected(row); setViewOpen(true); }}
                      onEdit={() => {
                        setSelected(row);
                        setForm({
                          product_id: String(row.product_id),
                          customer_id: row.customer_id ? String(row.customer_id) : "",
                          quantity: String(row.quantity),
                          selling_price: String(row.selling_price),
                          payment_type: row.payment_type || "CASH",
                          paid_amount: String(row.paid_amount || ""),
                          due_date: row.due_date ? String(row.due_date).slice(0, 16) : "",
                        });
                        setEditOpen(true);
                      }}
                      onPrint={() => printRecord({
                        title: "Sale Receipt",
                        fields: [
                          { label: "Sale ID", value: row.id },
                          { label: "Product", value: productNameById[row.product_id] || `#${row.product_id}` },
                          { label: "Quantity", value: row.quantity },
                          { label: "Paid Amount", value: formatPKR(row.paid_amount || 0) },
                          { label: "Due Amount", value: formatPKR(row.due_amount || 0) },
                          { label: "Payment Type", value: row.payment_type || "N/A" },
                          { label: "Revenue", value: row.revenue ? formatPKR(row.revenue) : "N/A" },
                          { label: "Profit", value: row.profit ? formatPKR(row.profit) : "N/A" },
                          { label: "Date", value: row.created_at ? new Date(row.created_at).toLocaleString() : "N/A" },
                        ],
                      })}
                      onDelete={() => setDeleting(row)}
                      disableEdit={role !== "owner"}
                      disableDelete={role !== "owner"}
                    />
                  ),
                },
              ]}
            />
          )}

          <Modal title="Edit Sale" open={editOpen} onClose={() => setEditOpen(false)}>
            <form className="grid gap-3" onSubmit={submitEdit}>
              <input className="input" value={productNameById[Number(form.product_id)] || `#${form.product_id}`} disabled />
              <select className="input" value={form.payment_type} onChange={(e) => setForm((prev) => ({ ...prev, payment_type: e.target.value }))}>
                <option value="CASH">Cash</option>
                <option value="CREDIT">Credit</option>
              </select>
              <select className="input" value={form.customer_id} onChange={(e) => setForm((prev) => ({ ...prev, customer_id: e.target.value }))}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} required />
              <input className="input" type="number" min="1" step="0.01" value={form.selling_price} onChange={(e) => setForm((prev) => ({ ...prev, selling_price: e.target.value }))} required />
              <input className="input" type="number" min="0" step="0.01" value={form.paid_amount} onChange={(e) => setForm((prev) => ({ ...prev, paid_amount: e.target.value }))} placeholder="Paid amount" />
              <input className="input" type="datetime-local" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
              <button className="btn-primary">Update Sale</button>
            </form>
          </Modal>

          <ConfirmDialog
            open={!!deleting}
            description={`Delete sale for ${deleting ? productNameById[deleting.product_id] || `#${deleting.product_id}` : "selected product"}?`}
            onClose={() => setDeleting(null)}
            onConfirm={deleteSale}
          />
        </>
      )}
    </div>
  );
}