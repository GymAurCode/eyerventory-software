import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "sonner";
import api from "../api/client";
import { posApi } from "../api/pos";
import AddProductDialog from "../components/AddProductDialog";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";

// ── Barcode print helpers ──────────────────────────────────────────────────────
async function printSingleBarcode(itemId, itemName, price, barcodeNumber) {
  let src = "";
  try {
    const blob = await posApi.getBarcodeImage(itemId);
    src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    toast.error("Failed to load barcode image");
    return;
  }
  const printWindow = window.open("", "_blank", "width=400,height=300");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html><html><head>
    <style>
      @page { size: 5cm 3cm; margin: 2mm; }
      body { margin: 0; padding: 0; font-family: monospace; display: flex; justify-content: center; align-items: center; }
      .label { width: 5cm; text-align: center; padding: 2mm; border: 0.5px solid #ccc; }
      .shop-name { font-size: 8px; font-weight: bold; }
      .item-name { font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .barcode-img { width: 100%; height: auto; }
      .barcode-num { font-size: 7px; letter-spacing: 1px; }
      .price { font-size: 10px; font-weight: bold; }
    </style></head><body>
    <div class="label">
      <div class="shop-name">EYERFLOW OPTICAL</div>
      <div class="item-name">${itemName}</div>
      <img class="barcode-img" src="${src}" alt="barcode" />
      <div class="barcode-num">${barcodeNumber}</div>
      <div class="price">Rs. ${price}</div>
    </div>
    <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
    </body></html>
  `);
  printWindow.document.close();
}

async function printBulkBarcodes(selectedItems) {
  const itemsWithSrc = await Promise.all(selectedItems.map(async (item) => {
    let src = "";
    try {
      const blob = await posApi.getBarcodeImage(item.id);
      src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // leave src empty — skip image
    }
    return { ...item, src };
  }));

  const labelsHTML = itemsWithSrc.map((item) => `
    <div class="label">
      <div class="shop-name">EYERFLOW OPTICAL</div>
      <div class="item-name">${item.name}</div>
      ${item.src ? `<img src="${item.src}" alt="barcode" />` : ""}
      <div class="barcode-num">${item.barcode_number || ""}</div>
      <div class="price">Rs. ${item.selling_price}</div>
    </div>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html><html><head>
    <style>
      @page { margin: 5mm; }
      body { margin: 0; font-family: monospace; }
      .labels-grid { display: grid; grid-template-columns: repeat(4, 5cm); gap: 2mm; }
      .label { width: 5cm; text-align: center; padding: 2mm; border: 0.5px solid #ccc; page-break-inside: avoid; }
      .shop-name { font-size: 8px; font-weight: bold; }
      .item-name { font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      img { width: 100%; height: auto; }
      .barcode-num { font-size: 7px; letter-spacing: 1px; }
      .price { font-size: 10px; font-weight: bold; }
    </style></head><body>
    <div class="labels-grid">${labelsHTML}</div>
    <script>
      const images = document.querySelectorAll('img');
      let loaded = 0;
      images.forEach(img => { img.onload = img.onerror = () => { loaded++; if (loaded === images.length) { window.print(); window.onafterprint = () => window.close(); } }; });
      if (images.length === 0) { window.print(); window.onafterprint = () => window.close(); }
    <\/script>
    </body></html>
  `);
  printWindow.document.close();
}

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
  const [showAddDialog, setShowAddDialog] = useState(false);
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
  const [form, setForm] = useState({ name: "", cost_price: "", selling_price: "", stock: "", image_data: "", image_mime: "" });
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Smart nudge: show after first manual add in this session
  const sessionAdds = useRef(0);
  const [showNudge, setShowNudge] = useState(false);
  const [barcodeImgUrl, setBarcodeImgUrl] = useState(null);

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

  const reset = () => setForm({ name: "", cost_price: "", selling_price: "", stock: "", image_data: "", image_mime: "" });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price || 0), stock: Number(form.stock) };
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
    setShowAddDialog(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setSelected(row);
    setForm({
      name: row.name,
      cost_price: String(row.cost_price),
      selling_price: String(row.selling_price || ""),
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

  useEffect(() => {
    if (viewOpen && selected?.barcode_number) {
      let cancelled = false;
      posApi.getBarcodeImage(selected.id)
        .then((blob) => { if (!cancelled) setBarcodeImgUrl(URL.createObjectURL(blob)); })
        .catch(() => { if (!cancelled) setBarcodeImgUrl(null); });
      return () => { cancelled = true; setBarcodeImgUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
    } else {
      setBarcodeImgUrl(null);
    }
  }, [viewOpen, selected?.id, selected?.barcode_number]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);

  const columns = [
    {
      key: "select", label: "", headerRender: () => (
        <input type="checkbox" className="w-4 h-4 accent-teal-500 cursor-pointer" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleSelectAll} />
      ),
      render: (row) => (
        <input type="checkbox" className="w-4 h-4 accent-teal-500 cursor-pointer" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} onClick={(e) => e.stopPropagation()} />
      ),
    },
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
      key: "barcode_number", label: "Barcode",
      render: (row) => row.barcode_number ? (
        <span className="font-mono text-xs">{row.barcode_number}</span>
      ) : (
        <button
          className="text-xs text-indigo-400 hover:text-indigo-300"
          onClick={async () => {
            try {
              await posApi.generateBarcode(row.id);
              await load();
              toast.success("Barcode generated");
            } catch { toast.error("Failed to generate barcode"); }
          }}
        >
          Generate
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button className="icon-btn icon-btn-view" onClick={() => openAddStock(row)} disabled={role !== "owner"} title="Add Stock">
            <i className="ti ti-package-plus" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-view" onClick={() => { setSelected(row); setViewOpen(true); }} title="View">
            <i className="ti ti-eye" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-edit" onClick={() => openEdit(row)} disabled={role !== "owner"} title="Edit">
            <i className="ti ti-pencil" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-view" onClick={() => {
            const bcNum = row.barcode_number;
            if (!bcNum) {
              posApi.generateBarcode(row.id).then(() => {
                load();
                printSingleBarcode(row.id, row.name, row.selling_price, row.barcode_number || "");
              }).catch(() => toast.error("Generate barcode first"));
              return;
            }
            printSingleBarcode(row.id, row.name, row.selling_price, bcNum);
          }} title="Print Label">
            <i className="ti ti-barcode" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-print" onClick={() => printRecord({
            title: "Product Details",
            fields: [
              { label: "Name", value: row.name },
              { label: "SKU", value: row.sku || "—" },
              { label: "Stock", value: row.stock },
              { label: "Cost Price", value: formatPKR(row.cost_price) },
              { label: "Selling Price", value: formatPKR(row.selling_price) },
              { label: "Category", value: row.category || "—" },
            ],
          })} title="Print">
            <i className="ti ti-printer" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-danger" onClick={() => setDeleting(row)} disabled={role !== "owner"} title="Delete Record">
            <i className="ti ti-trash" style={{ fontSize: "16px" }} />
          </button>
        </div>
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

            {/* Print Selected Labels */}
            {selectedIds.size > 0 && (
              <button
                className="btn-primary"
                onClick={() => {
                  const items = selectedRows.map((r) => ({
                    id: r.id, name: r.name, selling_price: r.selling_price, barcode_number: r.barcode_number,
                  }));
                  printBulkBarcodes(items);
                }}
              >
                🖨 Print Selected ({selectedIds.size})
              </button>
            )}

            {/* Bulk Barcode Generation */}
            <button
              className="btn-soft"
              onClick={async () => {
                try {
                  const result = await posApi.bulkGenerateBarcodes();
                  toast.success(`Generated ${result.generated} barcodes`);
                  await load();
                } catch { toast.error("Bulk generation failed"); }
              }}
              title="Generate barcodes for all products without one"
            >
              <i className="ti ti-barcode mr-1" /> Bulk Barcodes
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
        <StatCard title="Products" value={rows.length} tone="indigo" icon="ti-box" />
        <StatCard title="Total Stock" value={stockTotal} tone="amber" icon="ti-packages" />
        <StatCard title="Avg Cost" value={avgCost} tone="emerald" money icon="ti-calculator" />
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
          searchableColumns={["name", "cost_price", "stock", "barcode_number"]}
        />
      )}

      <AddProductDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => { setShowAddDialog(false); load(); }}
      />

      <Modal title={editingId ? "Edit Product" : "Add Product"} open={open} onClose={() => setOpen(false)}>
        <form className="grid grid-cols-1 gap-3" onSubmit={submit}>
          <input className="input" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Cost price (PKR)" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
          <input className="input" placeholder="Selling price (PKR)" type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <input className="input" placeholder="Stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
          <input className="input" type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} />
          {form.image_data && <img src={form.image_data} alt="Product preview" className="h-28 w-28 rounded-lg object-cover" />}
          <button className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update Product" : "Save Product"}</button>
        </form>
      </Modal>

      <Modal title={`Product Details — ${selected?.name || ""}`} open={viewOpen} onClose={() => setViewOpen(false)}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <p><strong>Name:</strong> {selected.name}</p>
              <p><strong>Category:</strong> {selected.category || "—"}</p>
              <p><strong>SKU:</strong> {selected.sku || "—"}</p>
              <p><strong>Stock:</strong> {selected.stock}</p>
              <p><strong>Cost Price:</strong> {formatPKR(selected.cost_price)}</p>
              <p><strong>Selling Price:</strong> {formatPKR(selected.selling_price)}</p>
            </div>
            {selected.image_data && <img src={selected.image_data} alt={selected.name} className="mt-2 max-h-48 w-full rounded-lg object-contain" />}

            {/* Barcode Section */}
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--border-color)" }}>
              <p className="font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Barcode</p>
              <div className="flex flex-col items-center">
                {selected.barcode_number ? (
                  <>
                    {barcodeImgUrl ? (
                      <img src={barcodeImgUrl} alt="Barcode" style={{ width: "200px", height: "auto" }} />
                    ) : (
                      <p className="font-mono text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                        No barcode generated
                      </p>
                    )}
                    <p className="font-mono text-sm text-center mt-1">{selected.barcode_number}</p>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>No barcode generated</p>
                )}
              </div>
              <div className="flex gap-2 justify-center mt-2">
                {selected.barcode_number ? (
                  <>
                    <button
                      className="btn-soft text-xs px-3 py-1"
                      onClick={() => printSingleBarcode(selected.id, selected.name, selected.selling_price, selected.barcode_number)}
                    >
                      <i className="ti ti-printer mr-1" /> Print Label
                    </button>
                    <button
                      className="btn-soft text-xs px-3 py-1"
                      onClick={async () => {
                        try {
                          const blob = await posApi.getBarcodeImage(selected.id);
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `barcode_${selected.id}.png`;
                          link.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error("Failed to download barcode");
                        }
                      }}
                    >
                      <i className="ti ti-download mr-1" /> Download PNG
                    </button>
                    <button
                      className="btn-soft text-xs px-3 py-1"
                      onClick={async () => {
                        try {
                          await posApi.generateBarcode(selected.id);
                          toast.success("Barcode regenerated");
                          await load();
                          const all = (await api.get("/products")).data;
                          const found = all.find((p) => p.id === selected.id);
                          if (found) setSelected(found);
                        } catch {
                          toast.error("Failed to regenerate barcode");
                        }
                      }}
                    >
                      <i className="ti ti-refresh mr-1" /> Regenerate
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary text-xs px-3 py-1"
                    onClick={async () => {
                        try {
                          await posApi.generateBarcode(selected.id);
                          toast.success("Barcode generated");
                          await load();
                          const all = (await api.get("/products")).data;
                          const found = all.find((p) => p.id === selected.id);
                          if (found) setSelected(found);
                        } catch {
                          toast.error("Failed to generate barcode");
                        }
                      }}
                  >
                    <i className="ti ti-barcode mr-1" /> Generate Barcode
                  </button>
                )}
              </div>
            </div>
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
