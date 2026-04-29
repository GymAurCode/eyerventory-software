import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "../api/client";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";

// ── Bulk import nudge tooltip — points at the Import Products button ──────────
function ImportNudgeTooltip({ onDismiss }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border px-4 py-3"
      style={{
        borderColor: "#6366F1",
        background: "color-mix(in srgb, #6366F1 8%, var(--bg-card))",
        animation: "nudge-pulse 2s ease-in-out 3",
      }}
    >
      {/* Arrow pointing up-right toward the header button */}
      <span
        className="mt-0.5 shrink-0 text-lg"
        style={{ animation: "bounce-up 1s ease-in-out infinite" }}
      >
        ☝️
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "#6366F1" }}>
          Adding multiple products?
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Use the <strong>Import Products</strong> button above to add many products at once via Excel.
        </p>
      </div>
      <button
        className="shrink-0 rounded px-1.5 py-0.5 text-xs transition-opacity hover:opacity-60"
        style={{ color: "var(--text-secondary)" }}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export default function ProductsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingId, setEditingId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: "", price: "" });
  const [form, setForm] = useState({ name: "", cost_price: "", stock: "", image_data: "", image_mime: "" });
  // Smart nudge: show after first manual add in this session
  const sessionAdds = useRef(0);
  const [showNudge, setShowNudge] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reset = () => setForm({ name: "", cost_price: "", stock: "", image_data: "", image_mime: "" });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), stock: Number(form.stock) };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", payload);
        toast.success("Product added successfully");
        // Track manual adds — show nudge after 2nd successful add
        sessionAdds.current += 1;
        if (sessionAdds.current >= 2) setShowNudge(true);
      }
      reset();
      setEditingId(0);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(0);
    reset();
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setSelected(row);
    setForm({
      name: row.name,
      cost_price: String(row.cost_price),
      stock: String(row.stock),
      image_data: row.image_data || "",
      image_mime: row.image_mime || "",
    });
    setOpen(true);
  };

  const onDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/products/${deleting.id}`);
      toast.info("Product deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete product");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openAddStock = (row) => {
    setStockTarget(row);
    setStockForm({ quantity: "", price: String(row.cost_price || "") });
    setAddStockOpen(true);
  };

  const submitAddStock = async (e) => {
    e.preventDefault();
    if (!stockTarget) return;
    const quantity = Number(stockForm.quantity);
    const parsedPrice = stockForm.price === "" ? null : Number(stockForm.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      toast.error("Price must be greater than 0");
      return;
    }
    setRestocking(true);
    try {
      const { data } = await api.post(`/products/add-stock/${stockTarget.id}`, {
        quantity,
        price: parsedPrice,
      });
      setItems((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setSelected((prev) => (prev?.id === data.id ? data : prev));
      setAddStockOpen(false);
      setStockTarget(null);
      toast.success("Stock added successfully");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add stock");
    } finally {
      setRestocking(false);
    }
  };

  const rows = useMemo(() => items, [items]);
  const stockTotal = useMemo(() => rows.reduce((sum, row) => sum + Number(row.stock || 0), 0), [rows]);
  const avgCost = useMemo(() => (rows.length ? rows.reduce((sum, row) => sum + Number(row.cost_price || 0), 0) / rows.length : 0), [rows]);

  const getStockMeta = (stock) => {
    if (stock === 0) {
      return {
        label: "Out of Stock",
        badgeClass: "border border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
        rowClass: "bg-rose-50/60 dark:bg-rose-950/25",
      };
    }
    if (stock <= 10) {
      return {
        label: "Low Stock",
        badgeClass: "border border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        rowClass: "bg-amber-50/60 dark:bg-amber-950/20",
      };
    }
    return {
      label: "",
      badgeClass: "",
      rowClass: "",
    };
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPG and PNG files are allowed");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image_data: String(reader.result), image_mime: file.type }));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubs = [
      registerPageAction("products.add", openCreate, { enabled: true }),
      registerPageAction("products.editSelected", () => selected && selected.stock > 0 && openEdit(selected), { enabled: !!selected && selected.stock > 0 }),
      registerPageAction("products.deleteSelected", () => selected && setDeleting(selected), { enabled: !!selected && role === "owner" }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [registerPageAction, role, selected, rows]);

  const columns = [
    { key: "image", label: "Image", render: (row) => row.image_data ? <img className="thumb-image" src={row.image_data} alt={row.name} /> : <span style={{ color: "var(--text-secondary)" }}>-</span> },
    { key: "name", label: "Name" },
    { key: "cost_price", label: "Cost Price", render: (row) => formatPKR(row.cost_price) },
    {
      key: "stock",
      label: "Stock",
      render: (row) => {
        const meta = getStockMeta(Number(row.stock || 0));
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.stock}</span>
            {meta.label && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>{meta.label}</span>}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => Number(row.stock || 0) === 0 ? (
        <div className="flex justify-end gap-2">
          <button className="btn-soft border-emerald-500/30 text-emerald-700 dark:text-emerald-300" onClick={() => openAddStock(row)} disabled={role !== "owner"}>
            Add Stock
          </button>
          <button className="btn-soft border-rose-500/30 text-rose-700 dark:text-rose-300" onClick={() => setDeleting(row)} aria-label="Delete" disabled={role !== "owner"}>
            Delete
          </button>
        </div>
      ) : (
        <ActionButtons
          onView={() => { setSelected(row); setViewOpen(true); }}
          onEdit={() => openEdit(row)}
          onDelete={() => setDeleting(row)}
          disableEdit={role !== "owner"}
          disableDelete={role !== "owner"}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle="Manage catalog and stock levels"
        actions={
          <>
            <button
              className={`btn-soft ${activeActionId === "products.editSelected" ? "ring-2 ring-indigo-500" : ""}`}
              title={`Edit Selected (${formatShortcut("products.editSelected")})`}
              onClick={() => selected && openEdit(selected)}
            >
              Edit Selected ({formatShortcut("products.editSelected")})
            </button>

            {/* Import Products button — always visible, navigates to Bulk Import tab */}
            <button
              className="btn-soft relative"
              style={{
                borderColor: showNudge ? "#6366F1" : undefined,
                color: showNudge ? "#6366F1" : undefined,
                boxShadow: showNudge ? "0 0 0 2px #6366F144" : undefined,
                animation: showNudge ? "nudge-pulse 2s ease-in-out infinite" : undefined,
              }}
              onClick={() => navigate("/analytics", { state: { tab: "Bulk Import" } })}
              title="Import products from Excel"
            >
              ⬆ Import Products
            </button>

            <button
              className={`btn-primary ${activeActionId === "products.add" ? "ring-2 ring-indigo-500" : ""}`}
              title={`Add Product (${formatShortcut("products.add")})`}
              onClick={openCreate}
            >
              + Add Product ({formatShortcut("products.add")})
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Products" value={String(rows.length)} tone="indigo" />
        <StatCard title="Total Stock" value={String(stockTotal)} tone="amber" />
        <StatCard title="Avg Cost" value={avgCost} tone="emerald" money />
      </div>

      {/* Nudge tooltip — appears below stat cards pointing up at the Import button */}
      {showNudge && (
        <ImportNudgeTooltip onDismiss={() => setShowNudge(false)} />
      )}

      {loading ? <LoadingSkeleton rows={6} /> : rows.length === 0 ? (
        <EmptyState title="No products yet" description="Create your first product to start inventory tracking." />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowClassName={(row) => getStockMeta(Number(row.stock || 0)).rowClass}
          searchPlaceholder="Search products by name, price, or stock..."
          searchableColumns={["name", "cost_price", "stock"]}
        />
      )}

      <Modal title={editingId ? "Edit Product" : "Add Product"} open={open} onClose={() => setOpen(false)}>
        <form className="grid grid-cols-1 gap-3" onSubmit={submit}>
          <input className="input" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Cost price (PKR)" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
          <input className="input" placeholder="Stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
          <input className="input" type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} />
          {form.image_data && <img src={form.image_data} alt="Product preview" className="h-28 w-28 rounded-lg object-cover" />}
          <button className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update Product" : "Save Product"}</button>
        </form>
      </Modal>

      <Modal title="Product Details" open={viewOpen} onClose={() => setViewOpen(false)}>
        {selected && (
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {selected.name}</p>
            <p><strong>Cost Price:</strong> {formatPKR(selected.cost_price)}</p>
            <p><strong>Stock:</strong> {selected.stock}</p>
            {selected.image_data && <img src={selected.image_data} alt={selected.name} className="mt-3 max-h-64 w-full rounded-lg object-contain" />}
          </div>
        )}
      </Modal>

      <Modal title={`Add Stock${stockTarget ? ` - ${stockTarget.name}` : ""}`} open={addStockOpen} onClose={() => setAddStockOpen(false)} maxWidth="max-w-md">
        <form className="grid gap-3" onSubmit={submitAddStock}>
          <div>
            <label className="mb-1 block text-sm" style={{ color: "var(--text-secondary)" }}>Quantity</label>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={stockForm.quantity}
              onChange={(e) => setStockForm((prev) => ({ ...prev, quantity: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm" style={{ color: "var(--text-secondary)" }}>Price per unit</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={stockForm.price}
              onChange={(e) => setStockForm((prev) => ({ ...prev, price: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border-color)" }}>
            Total: {formatPKR((Number(stockForm.quantity) || 0) * (Number(stockForm.price) || 0))}
          </div>
          <button className="btn-primary" disabled={restocking || !stockForm.quantity || Number(stockForm.quantity) <= 0 || (stockForm.price !== "" && Number(stockForm.price) <= 0)}>
            {restocking ? "Adding stock..." : "Add Stock"}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        description={`Delete "${deleting?.name || "this product"}"? This cannot be undone.`}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
