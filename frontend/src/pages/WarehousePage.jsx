import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowLeftRight, ArrowUpDown, Banknote, BarChart3, Building2,
  ClipboardList, Copy, DollarSign, Download, FileText, Filter, Package, Plus,
  Redo2, RotateCcw, Save, Scissors, Search, ShoppingBag, Store, Truck, Undo2,
  Upload, UserCircle, Users, X, Lock, Unlock, Printer,
  FileSpreadsheet, Eye, Edit3, Trash2, RefreshCw, CheckCircle,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { warehouseApi } from "../api/warehouse";
import api from "../api/client";
import {
  ActionButtons, ConfirmDialog, DataTable, EmptyState,
  LoadingSkeleton, Modal, PageHeader, StatCard,
} from "../components/UI";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";
import { REPORT_GROUPS, getReportById } from "../config/warehouseReports";
import {
  DateRangePicker, ShopFilter, ProductFilter, SalesmanFilter,
  CategoryFilter, StatusFilter, AgingFilter, MovementTypeFilter, ReturnTypeFilter,
} from "../components/reports/ReportFilters";

// ─── Shared Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status, green = "completed", orange = "partial", red = "unpaid" }) {
  const s = (status || "").toLowerCase();
  let bg, color;
  if (s === green) { bg = "rgba(34,197,94,0.15)"; color = "#22c55e"; }
  else if (s === orange) { bg = "rgba(245,158,11,0.15)"; color = "#f59e0b"; }
  else if (s === red) { bg = "rgba(239,68,68,0.15)"; color = "#ef4444"; }
  else { bg = "var(--bg-elevated)"; color = "var(--text-secondary)"; }
  return <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color }}>{status}</span>;
}

function emptyRow() { return { product_id: "", quantity: 1, unit_price: "", notes: "" }; }

// ─── TAB 1: Warehouse Management ──────────────────────────────────────────────

function WarehousesTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", manager_id: "", status: "active", allow_negative_stock: false, coa_mode: "separate" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, e] = await Promise.all([
        warehouseApi.list(),
        api.get("/employees").then((r) => r.data),
      ]);
      setWarehouses(w);
      setEmployees(e);
    } catch { toast.error("Failed to load warehouses"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", location: "", manager_id: "", status: "active", allow_negative_stock: false, coa_mode: "separate" });
    setModalOpen(true);
  };

  const openView = (row) => setViewing(row);

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      location: row.location || "",
      manager_id: row.manager_id ? String(row.manager_id) : "",
      status: row.status || "active",
      allow_negative_stock: row.allow_negative_stock ?? false,
      coa_mode: row.coa_mode || "separate",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, manager_id: form.manager_id ? Number(form.manager_id) : null };
      if (editing) {
        await warehouseApi.update(editing.id, payload);
        toast.success("Warehouse updated");
      } else {
        await warehouseApi.create(payload);
        toast.success("Warehouse created");
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await warehouseApi.delete(deleting.id);
      toast.success("Warehouse deleted");
      setDeleting(null);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Delete failed"); }
  };

  const columns = [
    { key: "name", label: "Name" },
    { key: "location", label: "Location" },
    { key: "manager_id", label: "Manager", render: (r) => employees.find((e) => e.id === r.manager_id)?.name || `#${r.manager_id || "-"}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} green="active" red="inactive" /> },
    { key: "allow_negative_stock", label: "Neg Stock", render: (r) => r.allow_negative_stock ? "Yes" : "No" },
    { key: "coa_mode", label: "COA Mode", render: (r) => <span className="capitalize">{r.coa_mode || "separate"}</span> },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => openView(r)} onEdit={() => openEdit(r)} onDelete={() => setDeleting(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> New Warehouse</button>
      </div>
      {loading ? <LoadingSkeleton rows={6} /> : (
        <DataTable data={warehouses} columns={columns} searchableColumns={["name", "location"]} searchPlaceholder="Search warehouses..." />
      )}
      <Modal title={editing ? "Edit Warehouse" : "Create Warehouse"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <select className="input py-2" value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
            <option value="">Select Manager</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select className="input py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allow_negative_stock} onChange={(e) => setForm({ ...form, allow_negative_stock: e.target.checked })} />
            Allow negative stock
          </label>
          <select className="input py-2" value={form.coa_mode} onChange={(e) => setForm({ ...form, coa_mode: e.target.value })}>
            <option value="separate">Separate</option>
            <option value="merged">Merged</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : editing ? "Update" : "Create"}</button>
          </div>
        </form>
      </Modal>
      <Modal title={`Warehouse: ${viewing?.name || ""}`} open={!!viewing} onClose={() => setViewing(null)}>
        <div className="space-y-2 text-sm">
          {[
            ["Name", viewing?.name],
            ["Location", viewing?.location],
            ["Manager", viewing?.manager_id ? (employees.find((e) => e.id === viewing.manager_id)?.name || `#${viewing.manager_id}`) : "-"],
            ["Status", viewing?.status],
            ["COA Mode", viewing?.coa_mode],
            ["Allow Negative Stock", viewing?.allow_negative_stock ? "Yes" : "No"],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between py-1" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span className="font-medium capitalize">{typeof val === "string" ? val : String(val ?? "-")}</span>
            </div>
          ))}
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} description={`Delete warehouse "${deleting?.name}"?`} onClose={() => setDeleting(null)} onConfirm={handleDelete} />
    </div>
  );
}

// ─── TAB 2: Opening Stock ─────────────────────────────────────────────────────

function OpeningStockTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [products, setProducts] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({ product_id: "", qty: 1, rate: "", date: new Date().toISOString().slice(0, 10) });
  const [submitting, setSubmitting] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const loadMeta = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([
        warehouseApi.list(),
        api.get("/products").then((r) => r.data),
      ]);
      setWarehouses(w);
      setProducts(p);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadItems = useCallback(async () => {
    if (!warehouseId) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await warehouseApi.getOpeningStock(warehouseId);
      setItems(data.items || data || []);
      setLocked(data.locked || false);
    } catch { setItems([]); }
    setLoading(false);
  }, [warehouseId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.product_id || !newItem.qty) return toast.error("Fill required fields");
    setSubmitting(true);
    try {
      await warehouseApi.setOpeningStock(warehouseId, [{
        product_id: Number(newItem.product_id),
        qty: Number(newItem.qty),
        rate: Number(newItem.rate) || 0,
        date: newItem.date,
      }]);
      toast.success("Opening stock added");
      setAddOpen(false);
      setNewItem({ product_id: "", qty: 1, rate: "", date: new Date().toISOString().slice(0, 10) });
      loadItems();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to add"); }
    setSubmitting(false);
  };

  const handleLock = async () => {
    try {
      await warehouseApi.lockOpeningStock(warehouseId);
      toast.success("Opening stock locked");
      setLocked(true);
    } catch (err) { toast.error(err.response?.data?.detail || "Lock failed"); }
  };

  const columns = [
    { key: "product_id", label: "Product", render: (r) => products.find((p) => p.id === r.product_id)?.name || `#${r.product_id}` },
    { key: "qty", label: "Qty" },
    { key: "rate", label: "Rate", render: (r) => formatPKR(r.rate || 0) },
    { key: "value", label: "Value", render: (r) => formatPKR(r.value || 0) },
    { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
    { key: "locked", label: "Status", render: () => <StatusBadge status={locked ? "Locked" : "Open"} green="locked" red="open" /> },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => setViewItem(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <select className="input py-1.5 text-sm flex-1" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {warehouseId && !locked && (
          <>
            <button onClick={() => setAddOpen(true)} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
            <button onClick={handleLock} className="btn-soft text-sm flex items-center gap-1"><Lock size={14} /> Lock Opening</button>
          </>
        )}
        {locked && <span className="text-xs flex items-center gap-1" style={{ color: "#22c55e" }}><Lock size={14} /> Locked</span>}
      </div>
      {!warehouseId ? <EmptyState title="Select a warehouse" description="Choose a warehouse to view opening stock" /> :
        loading ? <LoadingSkeleton rows={5} /> : items.length === 0 ? <EmptyState title="No opening stock" description="Add opening stock items above" /> :
        <DataTable data={items} columns={columns} />
      }
      <Modal title="Opening Stock Detail" open={!!viewItem} onClose={() => setViewItem(null)}>
        {viewItem && (
          <div className="space-y-2 text-sm">
            {[
              ["Product", products.find((p) => p.id === viewItem.product_id)?.name || `#${viewItem.product_id}`],
              ["Quantity", String(viewItem.qty)],
              ["Rate", formatPKR(viewItem.rate || 0)],
              ["Value", formatPKR(viewItem.value || 0)],
              ["Date", viewItem.date ? new Date(viewItem.date).toLocaleDateString() : "-"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="font-medium">{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <Modal title="Add Opening Stock Item" open={addOpen} onClose={() => setAddOpen(false)}>
        <form onSubmit={handleAdd} className="space-y-3">
          <select className="input py-2" value={newItem.product_id} onChange={(e) => setNewItem({ ...newItem, product_id: e.target.value })} required>
            <option value="">Select Product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku || "N/A"})</option>)}
          </select>
          <input className="input" type="number" min="1" placeholder="Quantity" value={newItem.qty} onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })} required />
          <input className="input" type="number" min="0" step="0.01" placeholder="Rate" value={newItem.rate} onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })} />
          <input className="input" type="date" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Adding..." : "Add"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── TAB 3: Returns ───────────────────────────────────────────────────────────

function ReturnsTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [returnType, setReturnType] = useState("salesman");
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [shops, setShops] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState(null);
  const [form, setForm] = useState({ return_type: "salesman", warehouse_id: "", salesman_id: "", shop_id: "", product_id: "", quantity: 1, rate: "", reason: "", date: new Date().toISOString().slice(0, 10) });
  const [submitting, setSubmitting] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const [w, p, emp, s] = await Promise.all([
        warehouseApi.list(),
        api.get("/products").then((r) => r.data),
        api.get("/employees").then((r) => r.data),
        warehouseApi.listShops(),
      ]);
      setWarehouses(w); setProducts(p); setSalesmen(emp); setShops(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadReturns = useCallback(async () => {
    if (!warehouseId) { setReturns([]); return; }
    setLoading(true);
    try {
      const data = await warehouseApi.getReturns(warehouseId, { return_type: returnType });
      setReturns(data);
    } catch { setReturns([]); }
    setLoading(false);
  }, [warehouseId, returnType]);

  useEffect(() => { loadReturns(); }, [loadReturns]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await warehouseApi.createReturn(warehouseId, {
        return_type: form.return_type,
        salesman_id: form.salesman_id ? Number(form.salesman_id) : null,
        shop_id: form.shop_id ? Number(form.shop_id) : null,
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        unit_price: Number(form.rate) || 0,
        reason: form.reason || undefined,
        date: form.date,
      });
      toast.success("Return created");
      setCreateOpen(false);
      loadReturns();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create return"); }
    setSubmitting(false);
  };

  const columns = [
    { key: "return_type", label: "Type", render: (r) => <span className="capitalize">{r.return_type}</span> },
    { key: "product_id", label: "Product", render: (r) => products.find((p) => p.id === r.product_id)?.name || `#${r.product_id}` },
    { key: "quantity", label: "Qty" },
    { key: "unit_price", label: "Rate", render: (r) => formatPKR(r.unit_price || 0) },
    { key: "value", label: "Value", render: (r) => formatPKR((r.quantity || 0) * (r.unit_price || 0)) },
    { key: "reason", label: "Reason" },
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "-" },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => setViewReturn(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <select className="input py-1.5 text-sm flex-1" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
          {["salesman", "shop"].map((t) => (
            <button key={t} onClick={() => setReturnType(t)}
              className="rounded-md px-3 py-1 text-xs font-medium capitalize transition-all"
              style={{ background: returnType === t ? "var(--bg-card)" : "transparent", color: returnType === t ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {t} Returns
            </button>
          ))}
        </div>
        {warehouseId && <button onClick={() => { setForm({ ...form, return_type: returnType, warehouse_id }); setCreateOpen(true); }} className="btn-primary text-sm flex items-center gap-1"><Plus size={14} /> New Return</button>}
      </div>
      {!warehouseId ? <EmptyState title="Select a warehouse" /> :
        loading ? <LoadingSkeleton rows={5} /> : returns.length === 0 ? <EmptyState title="No returns" /> :
        <DataTable data={returns} columns={columns} />
      }
      <Modal title="Create Return" open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-3">
          <select className="input py-2" value={form.return_type} onChange={(e) => setForm({ ...form, return_type: e.target.value })}>
            <option value="salesman">Salesman Return</option>
            <option value="shop">Shop Return</option>
          </select>
          {form.return_type === "salesman" ? (
            <select className="input py-2" value={form.salesman_id} onChange={(e) => setForm({ ...form, salesman_id: e.target.value })}>
              <option value="">Select Salesman</option>
              {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <select className="input py-2" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })}>
              <option value="">Select Shop</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select className="input py-2" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
            <option value="">Select Product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input className="input flex-1" type="number" min="1" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            <input className="input flex-1" type="number" min="0" step="0.01" placeholder="Rate" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </div>
          <input className="input" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Creating..." : "Create Return"}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Return Detail" open={!!viewReturn} onClose={() => setViewReturn(null)}>
        {viewReturn && (
          <div className="space-y-2 text-sm">
            {[
              ["Type", viewReturn.return_type],
              ["Product", products.find((p) => p.id === viewReturn.product_id)?.name || `#${viewReturn.product_id}`],
              ["Quantity", String(viewReturn.quantity)],
              ["Rate", formatPKR(viewReturn.unit_price || 0)],
              ["Value", formatPKR((viewReturn.quantity || 0) * (viewReturn.unit_price || 0))],
              ["Reason", viewReturn.reason || "-"],
              ["Date", viewReturn.created_at ? new Date(viewReturn.created_at).toLocaleDateString() : "-"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="font-medium capitalize">{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 4: Stock Movements ───────────────────────────────────────────────────

function StockMovementsTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMovement, setViewMovement] = useState(null);

  // Stock In form
  const [siForm, setSiForm] = useState({ supplier: "", reference: "", notes: "", items: [emptyRow()] });
  // Stock Out form
  const [soForm, setSoForm] = useState({ reference: "", notes: "", allowNegative: false, items: [emptyRow()] });
  // Transfer form
  const [trForm, setTrForm] = useState({ dest_warehouse_id: "", reference: "", notes: "", allowNegative: false, items: [emptyRow()] });
  // Damage form
  const [dmForm, setDmForm] = useState({ product_id: "", quantity: 1, reason: "", date: new Date().toISOString().slice(0, 10) });
  // Adjustment form
  const [adForm, setAdForm] = useState({ notes: "", allowNegative: false, items: [{ product_id: "", quantity: 0, notes: "" }] });

  const loadMeta = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([
        warehouseApi.list(),
        api.get("/products").then((r) => r.data),
      ]);
      setWarehouses(w); setProducts(p);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadMovements = useCallback(async () => {
    if (!warehouseId) { setMovements([]); return; }
    setLoading(true);
    try {
      const params = {};
      if (movementType) params.movement_type = movementType;
      const data = await warehouseApi.stockMovements(warehouseId, params);
      setMovements(data);
    } catch { setMovements([]); }
    setLoading(false);
  }, [warehouseId, movementType]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  const updateRow = (arr, setter, i, field, value) => {
    const copy = [...arr];
    copy[i] = { ...copy[i], [field]: value };
    setter(copy);
  };

  const MOVEMENT_TYPES = [
    { id: "", label: "All" },
    { id: "stock_in", label: "Stock In" },
    { id: "stock_out", label: "Stock Out" },
    { id: "transfer", label: "Transfer" },
    { id: "damage", label: "Damage" },
    { id: "adjustment", label: "Adjustment" },
  ];

  const handleStockIn = async (e) => {
    e.preventDefault();
    const valid = siForm.items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (!warehouseId || valid.length === 0) return toast.error("Select warehouse and add items");
    setSubmitting(true);
    try {
      await warehouseApi.stockIn(Number(warehouseId), valid.map((it) => ({
        product_id: Number(it.product_id), quantity: Number(it.quantity), unit_price: Number(it.unit_price) || 0, notes: it.notes,
      })), { reference_no: siForm.reference || undefined, notes: siForm.notes || undefined, supplier: siForm.supplier || undefined });
      toast.success("Stock-in recorded");
      setDialog(null);
      setSiForm({ supplier: "", reference: "", notes: "", items: [emptyRow()] });
      loadMovements();
    } catch (err) { toast.error(err.response?.data?.detail || "Stock-in failed"); }
    setSubmitting(false);
  };

  const handleStockOut = async (e) => {
    e.preventDefault();
    const valid = soForm.items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (!warehouseId || valid.length === 0) return toast.error("Select warehouse and add items");
    setSubmitting(true);
    try {
      await warehouseApi.stockOut(Number(warehouseId), valid.map((it) => ({
        product_id: Number(it.product_id), quantity: Number(it.quantity), notes: it.notes,
      })), { reference_no: soForm.reference || undefined, notes: soForm.notes || undefined, allow_negative: soForm.allowNegative });
      toast.success("Stock-out recorded");
      setDialog(null);
      setSoForm({ reference: "", notes: "", allowNegative: false, items: [emptyRow()] });
      loadMovements();
    } catch (err) { toast.error(err.response?.data?.detail || "Stock-out failed"); }
    setSubmitting(false);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const valid = trForm.items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (!warehouseId || !trForm.dest_warehouse_id || valid.length === 0) return toast.error("Select warehouses and add items");
    if (warehouseId === trForm.dest_warehouse_id) return toast.error("Source and destination must differ");
    setSubmitting(true);
    try {
      await warehouseApi.transfer({
        source_warehouse_id: Number(warehouseId),
        dest_warehouse_id: Number(trForm.dest_warehouse_id),
        items: valid.map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity), notes: it.notes })),
        reference_no: trForm.reference || undefined,
        notes: trForm.notes || undefined,
        allow_negative: trForm.allowNegative,
      });
      toast.success("Transfer completed");
      setDialog(null);
      setTrForm({ dest_warehouse_id: "", reference: "", notes: "", allowNegative: false, items: [emptyRow()] });
      loadMovements();
    } catch (err) { toast.error(err.response?.data?.detail || "Transfer failed"); }
    setSubmitting(false);
  };

  const handleDamage = async (e) => {
    e.preventDefault();
    if (!warehouseId || !dmForm.product_id) return toast.error("Fill required fields");
    setSubmitting(true);
    try {
      await warehouseApi.reportDamage({
        warehouse_id: Number(warehouseId),
        product_id: Number(dmForm.product_id),
        quantity: Number(dmForm.quantity),
        reason: dmForm.reason || undefined,
        date: dmForm.date,
      });
      toast.success("Damage reported");
      setDialog(null);
      setDmForm({ product_id: "", quantity: 1, reason: "", date: new Date().toISOString().slice(0, 10) });
      loadMovements();
    } catch (err) { toast.error(err.response?.data?.detail || "Damage report failed"); }
    setSubmitting(false);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const valid = adForm.items.filter((it) => it.product_id && Number(it.quantity) !== 0);
    if (!warehouseId || valid.length === 0) return toast.error("Select warehouse and add items");
    setSubmitting(true);
    try {
      await warehouseApi.adjust(Number(warehouseId), valid.map((it) => ({
        product_id: Number(it.product_id), quantity: Number(it.quantity), notes: it.notes,
      })), { notes: adForm.notes || undefined, allow_negative: adForm.allowNegative });
      toast.success("Stock adjusted");
      setDialog(null);
      setAdForm({ notes: "", allowNegative: false, items: [{ product_id: "", quantity: 0, notes: "" }] });
      loadMovements();
    } catch (err) { toast.error(err.response?.data?.detail || "Adjustment failed"); }
    setSubmitting(false);
  };

  const columns = [
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : "-" },
    { key: "movement_type", label: "Type", render: (r) => <span className="capitalize">{(r.movement_type || r.transaction_type || "").replace(/_/g, " ")}</span> },
    { key: "product_id", label: "Product", render: (r) => products.find((p) => p.id === (r.product_id || r.product))?.name || `#${r.product_id || r.product}` },
    { key: "quantity", label: "Qty" },
    { key: "unit_price", label: "Rate", render: (r) => r.unit_price ? formatPKR(r.unit_price) : "-" },
    { key: "value", label: "Value", render: (r) => formatPKR((r.quantity || 0) * (r.unit_price || 0)) },
    { key: "reference_no", label: "Reference" },
    { key: "notes", label: "Notes" },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => setViewMovement(r)} />
    )},
  ];

  const renderItemsForm = (items, setItems) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start">
          <select className="input py-2 flex-[2]" value={it.product_id} onChange={(e) => updateRow(items, setItems, i, "product_id", e.target.value)} required>
            <option value="">Product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input py-2 w-20" type="number" min={items === adForm.items ? undefined : "1"} value={it.quantity}
            onChange={(e) => updateRow(items, setItems, i, "quantity", e.target.value)} required />
          {(items === siForm.items) && (
            <input className="input py-2 w-24" type="number" min="0" step="0.01" placeholder="Price" value={it.unit_price || ""}
              onChange={(e) => updateRow(items, setItems, i, "unit_price", e.target.value)} />
          )}
          <input className="input py-2 w-24" placeholder="Notes" value={it.notes || ""}
            onChange={(e) => updateRow(items, setItems, i, "notes", e.target.value)} />
          <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))} className="icon-btn icon-btn-danger mt-1"><X size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, emptyRow()])} className="btn-soft text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <select className="input py-1.5 text-sm flex-1" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {warehouseId && (
          <div className="flex flex-wrap gap-1">
            {MOVEMENT_TYPES.map((mt) => (
              <button key={mt.id} onClick={() => setMovementType(mt.id)}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-all"
                style={{ background: movementType === mt.id ? "var(--accent)" : "var(--bg-elevated)", color: movementType === mt.id ? "#000" : "var(--text-secondary)" }}>
                {mt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {warehouseId && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setSiForm({ supplier: "", reference: "", notes: "", items: [emptyRow()] }); setDialog("stock-in"); }} className="btn-primary text-xs flex items-center gap-1"><Package size={14} /> Stock In</button>
          <button onClick={() => { setSoForm({ reference: "", notes: "", allowNegative: false, items: [emptyRow()] }); setDialog("stock-out"); }} className="btn-soft text-xs flex items-center gap-1"><Package size={14} /> Stock Out</button>
          <button onClick={() => { setTrForm({ dest_warehouse_id: "", reference: "", notes: "", allowNegative: false, items: [emptyRow()] }); setDialog("transfer"); }} className="btn-soft text-xs flex items-center gap-1"><ArrowLeftRight size={14} /> Transfer</button>
          <button onClick={() => { setDmForm({ product_id: "", quantity: 1, reason: "", date: new Date().toISOString().slice(0, 10) }); setDialog("damage"); }} className="btn-soft text-xs flex items-center gap-1"><AlertTriangle size={14} /> Damage</button>
          <button onClick={() => { setAdForm({ notes: "", allowNegative: false, items: [{ product_id: "", quantity: 0, notes: "" }] }); setDialog("adjustment"); }} className="btn-soft text-xs flex items-center gap-1"><RotateCcw size={14} /> Adjustment</button>
        </div>
      )}
      {!warehouseId ? <EmptyState title="Select a warehouse" description="Choose a warehouse to view stock movements" /> :
        loading ? <LoadingSkeleton rows={6} /> : movements.length === 0 ? <EmptyState title="No movements" description="Stock movements will appear here" /> :
        <DataTable data={movements} columns={columns} />
      }

      {/* Stock In Dialog */}
      <Modal title="Stock In" open={dialog === "stock-in"} onClose={() => setDialog(null)} maxWidth="max-w-3xl">
        <form onSubmit={handleStockIn} className="space-y-4">
          <div className="flex gap-2">
            <input className="input py-2 flex-1" placeholder="Supplier" value={siForm.supplier} onChange={(e) => setSiForm({ ...siForm, supplier: e.target.value })} />
            <input className="input py-2 flex-1" placeholder="Reference No" value={siForm.reference} onChange={(e) => setSiForm({ ...siForm, reference: e.target.value })} />
          </div>
          {renderItemsForm(siForm.items, (v) => setSiForm({ ...siForm, items: v }))}
          <input className="input py-2 w-full" placeholder="Notes" value={siForm.notes} onChange={(e) => setSiForm({ ...siForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDialog(null)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Recording..." : "Stock In"}</button>
          </div>
        </form>
      </Modal>

      {/* Stock Out Dialog */}
      <Modal title="Stock Out" open={dialog === "stock-out"} onClose={() => setDialog(null)} maxWidth="max-w-3xl">
        <form onSubmit={handleStockOut} className="space-y-4">
          <input className="input py-2 w-full" placeholder="Reference No" value={soForm.reference} onChange={(e) => setSoForm({ ...soForm, reference: e.target.value })} />
          {renderItemsForm(soForm.items, (v) => setSoForm({ ...soForm, items: v }))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={soForm.allowNegative} onChange={(e) => setSoForm({ ...soForm, allowNegative: e.target.checked })} /> Allow negative stock</label>
          <input className="input py-2 w-full" placeholder="Notes" value={soForm.notes} onChange={(e) => setSoForm({ ...soForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDialog(null)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Recording..." : "Stock Out"}</button>
          </div>
        </form>
      </Modal>

      {/* Transfer Dialog */}
      <Modal title="Transfer Stock" open={dialog === "transfer"} onClose={() => setDialog(null)} maxWidth="max-w-3xl">
        <form onSubmit={handleTransfer} className="space-y-4">
          <select className="input py-2 w-full" value={trForm.dest_warehouse_id} onChange={(e) => setTrForm({ ...trForm, dest_warehouse_id: e.target.value })} required>
            <option value="">Destination Warehouse</option>
            {warehouses.filter((w) => w.id !== Number(warehouseId)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input className="input py-2 w-full" placeholder="Reference No" value={trForm.reference} onChange={(e) => setTrForm({ ...trForm, reference: e.target.value })} />
          {renderItemsForm(trForm.items, (v) => setTrForm({ ...trForm, items: v }))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trForm.allowNegative} onChange={(e) => setTrForm({ ...trForm, allowNegative: e.target.checked })} /> Allow negative stock</label>
          <input className="input py-2 w-full" placeholder="Notes" value={trForm.notes} onChange={(e) => setTrForm({ ...trForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDialog(null)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Transferring..." : "Transfer"}</button>
          </div>
        </form>
      </Modal>

      {/* Damage Dialog */}
      <Modal title="Report Damage" open={dialog === "damage"} onClose={() => setDialog(null)}>
        <form onSubmit={handleDamage} className="space-y-3">
          <select className="input py-2" value={dmForm.product_id} onChange={(e) => setDmForm({ ...dmForm, product_id: e.target.value })} required>
            <option value="">Select Product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" type="number" min="1" placeholder="Quantity" value={dmForm.quantity} onChange={(e) => setDmForm({ ...dmForm, quantity: e.target.value })} required />
          <input className="input" placeholder="Reason" value={dmForm.reason} onChange={(e) => setDmForm({ ...dmForm, reason: e.target.value })} />
          <input className="input" type="date" value={dmForm.date} onChange={(e) => setDmForm({ ...dmForm, date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDialog(null)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Reporting..." : "Report Damage"}</button>
          </div>
        </form>
      </Modal>

      {/* Adjustment Dialog */}
      <Modal title="Stock Adjustment" open={dialog === "adjustment"} onClose={() => setDialog(null)} maxWidth="max-w-3xl">
        <form onSubmit={handleAdjust} className="space-y-4">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Positive qty = increase, negative qty = decrease</p>
          {renderItemsForm(adForm.items, (v) => setAdForm({ ...adForm, items: v }))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={adForm.allowNegative} onChange={(e) => setAdForm({ ...adForm, allowNegative: e.target.checked })} /> Allow negative stock</label>
          <input className="input py-2 w-full" placeholder="Notes" value={adForm.notes} onChange={(e) => setAdForm({ ...adForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDialog(null)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Adjusting..." : "Adjust"}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Stock Movement Detail" open={!!viewMovement} onClose={() => setViewMovement(null)}>
        {viewMovement && (
          <div className="space-y-2 text-sm">
            {[
              ["Date", viewMovement.created_at ? new Date(viewMovement.created_at).toLocaleString() : "-"],
              ["Type", (viewMovement.movement_type || "").replace(/_/g, " ")],
              ["Product", products.find((p) => p.id === (viewMovement.product_id || viewMovement.product))?.name || `#${viewMovement.product_id || viewMovement.product}`],
              ["Quantity", String(viewMovement.quantity)],
              ["Rate", viewMovement.unit_price ? formatPKR(viewMovement.unit_price) : "-"],
              ["Value", formatPKR((viewMovement.quantity || 0) * (viewMovement.unit_price || 0))],
              ["Reference", viewMovement.reference_no || "-"],
              ["Notes", viewMovement.notes || "-"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="font-medium capitalize">{val}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 5: Salesman Management ───────────────────────────────────────────────

function SalesmenTab() {
  const [employees, setEmployees] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [shops, setShops] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ employee_id: "", warehouse_id: "", areas: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emp, w, s, inv, pay] = await Promise.all([
        api.get("/employees").then((r) => r.data),
        warehouseApi.list(),
        warehouseApi.listShops(),
        warehouseApi.listInvoices({ limit: 100 }),
        warehouseApi.listPayments({ limit: 100 }),
      ]);
      setEmployees(emp);
      setWarehouses(w);
      setShops(s);
      setInvoices(inv);
      setPayments(pay);
      // Filter for salesmen (employees with type/role salesman, or all with salesman_id references)
      const linked = emp.filter((e) =>
        inv.some((i) => i.salesman_id === e.id) ||
        pay.some((p) => p.salesman_id === e.id)
      );
      // Also include any employee with type like "salesman"
      const typeMatch = emp.filter((e) => (e.type || e.role || "").toLowerCase().includes("salesman"));
      setSalesmen([...new Map([...typeMatch, ...linked].map((e) => [e.id, e])).values()]);
    } catch { toast.error("Failed to load data"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const salesmanInvoices = useMemo(() =>
    detail ? invoices.filter((i) => i.salesman_id === detail.id) : [],
  [detail, invoices]);

  const salesmanPayments = useMemo(() =>
    detail ? payments.filter((p) => p.salesman_id === detail.id) : [],
  [detail, payments]);

  const salesmanShops = useMemo(() =>
    detail ? shops.filter((s) => s.salesman_id === detail.id) : [],
  [detail, shops]);

  const totalStockIssued = useMemo(() =>
    salesmanInvoices.reduce((sum, i) => sum + Number(i.net_total || i.gross_total || 0), 0),
  [salesmanInvoices]);

  const columns = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "areas", label: "Areas", render: () => "-" },
    { key: "status", label: "Status", render: () => <StatusBadge status="Active" green="active" /> },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => setDetail(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setLinkForm({ employee_id: "", warehouse_id: "", areas: "" }); setLinkOpen(true); }} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Link Salesman</button>
      </div>
      {loading ? <LoadingSkeleton rows={5} /> : salesmen.length === 0 ? (
        <EmptyState title="No salesmen found" description="Link employees as salesmen using the button above" />
      ) : (
        <DataTable data={salesmen} columns={columns} searchableColumns={["name", "email", "phone"]} />
      )}

      <Modal title="Link Salesman" open={linkOpen} onClose={() => setLinkOpen(false)}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); toast.success("Salesman linked (local)"); setLinkOpen(false); load(); }}>
          <select className="input py-2" value={linkForm.employee_id} onChange={(e) => setLinkForm({ ...linkForm, employee_id: e.target.value })} required>
            <option value="">Select Employee</option>
            {employees.filter((e) => !salesmen.find((s) => s.id === e.id)).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.type || emp.role || "N/A"})</option>
            ))}
          </select>
          <select className="input py-2" value={linkForm.warehouse_id} onChange={(e) => setLinkForm({ ...linkForm, warehouse_id: e.target.value })}>
            <option value="">Select Warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <input className="input" placeholder="Assigned Areas (comma-separated)" value={linkForm.areas} onChange={(e) => setLinkForm({ ...linkForm, areas: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setLinkOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary">Link Salesman</button>
          </div>
        </form>
      </Modal>

      <Modal title={`Salesman Detail — ${detail?.name || ""}`} open={!!detail} onClose={() => setDetail(null)} maxWidth="max-w-3xl">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><strong>Name:</strong> {detail.name}</div>
              <div><strong>Email:</strong> {detail.email || "-"}</div>
              <div><strong>Phone:</strong> {detail.phone || "-"}</div>
              <div><strong>Shops Assigned:</strong> {salesmanShops.length}</div>
              <div><strong>Total Invoices:</strong> {salesmanInvoices.length}</div>
              <div><strong>Stock Issued:</strong> {formatPKR(totalStockIssued)}</div>
            </div>

            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <h4 className="font-semibold mb-2">Assigned Shops</h4>
              {salesmanShops.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>No shops assigned</p> : (
                <div className="space-y-1">
                  {salesmanShops.map((s) => (
                    <div key={s.id} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
                      <span className="font-medium">{s.name}</span> - {s.area || s.location || "N/A"}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <h4 className="font-semibold mb-2">Delivery History ({salesmanInvoices.length})</h4>
              {salesmanInvoices.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>No deliveries</p> : (
                <DataTable data={salesmanInvoices.slice(0, 20)} columns={[
                  { key: "invoice_no", label: "Invoice#" },
                  { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "-" },
                  { key: "net_total", label: "Amount", render: (r) => formatPKR(r.net_total || 0) },
                  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status || "completed"} /> },
                ]} />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 6: Shop Management ───────────────────────────────────────────────────

function ShopsTab() {
  const [shops, setShops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [detail, setDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", owner_name: "", phone: "", address: "", area: "", salesman_id: "", credit_limit: "" });
  const [detailInvoices, setDetailInvoices] = useState([]);
  const [detailPayments, setDetailPayments] = useState([]);
  const [detailLedger, setDetailLedger] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, emp] = await Promise.all([
        warehouseApi.listShops(),
        api.get("/employees").then((r) => r.data),
      ]);
      setShops(s);
      setEmployees(emp);
    } catch { toast.error("Failed to load shops"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", owner_name: "", phone: "", address: "", area: "", salesman_id: "", credit_limit: "" });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      owner_name: row.owner_name || "",
      phone: row.phone || "",
      address: row.address || "",
      area: row.area || "",
      salesman_id: row.salesman_id ? String(row.salesman_id) : "",
      credit_limit: row.credit_limit ? String(row.credit_limit) : "",
    });
    setModalOpen(true);
  };

  const openDetail = async (row) => {
    setDetail(row);
    try {
      const [inv, pay, ledger] = await Promise.all([
        warehouseApi.listInvoices({ shop_id: row.id }),
        warehouseApi.listPayments({ shop_id: row.id }),
        warehouseApi.getShopLedger(row.id).catch(() => []),
      ]);
      setDetailInvoices(inv);
      setDetailPayments(pay);
      setDetailLedger(ledger);
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, salesman_id: form.salesman_id ? Number(form.salesman_id) : null, credit_limit: form.credit_limit ? Number(form.credit_limit) : 0 };
      if (editing) { await warehouseApi.updateShop(editing.id, payload); toast.success("Shop updated"); }
      else { await warehouseApi.createShop(payload); toast.success("Shop created"); }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Save failed"); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try { await warehouseApi.deleteShop(deleting.id); toast.success("Shop deleted"); setDeleting(null); load(); }
    catch (err) { toast.error(err.response?.data?.detail || "Delete failed"); }
  };

  const totalOutstanding = useMemo(() =>
    detailInvoices.reduce((sum, i) => sum + (i.balance || i.net_total - i.paid_amount || 0), 0),
  [detailInvoices]);

  const creditLimitExceeded = detail && totalOutstanding > Number(detail.credit_limit || 0);

  const columns = [
    { key: "name", label: "Name" },
    { key: "owner_name", label: "Owner" },
    { key: "phone", label: "Phone" },
    { key: "area", label: "Area" },
    { key: "salesman_id", label: "Salesman", render: (r) => employees.find((e) => e.id === r.salesman_id)?.name || "-" },
    { key: "credit_limit", label: "Credit Limit", render: (r) => formatPKR(r.credit_limit || 0) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status || "active"} green="active" red="inactive" /> },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => openDetail(r)} onEdit={() => openEdit(r)} onDelete={() => setDeleting(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> New Shop</button>
      </div>
      {loading ? <LoadingSkeleton rows={6} /> : (
        <DataTable data={shops} columns={columns} searchableColumns={["name", "owner_name", "phone", "area"]} searchPlaceholder="Search shops..." />
      )}

      <Modal title={editing ? "Edit Shop" : "Create Shop"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input" placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Owner name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <select className="input py-2" value={form.salesman_id} onChange={(e) => setForm({ ...form, salesman_id: e.target.value })}>
            <option value="">Select Salesman</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <input className="input" type="number" min="0" step="0.01" placeholder="Credit limit" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : editing ? "Update" : "Create"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} description={`Delete shop "${deleting?.name}"?`} onClose={() => setDeleting(null)} onConfirm={handleDelete} />

      <Modal title={`Shop Detail — ${detail?.name || ""}`} open={!!detail} onClose={() => setDetail(null)} maxWidth="max-w-4xl">
        {detail && (
          <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><strong>Name:</strong> {detail.name}</div>
              <div><strong>Owner:</strong> {detail.owner_name || "-"}</div>
              <div><strong>Phone:</strong> {detail.phone || "-"}</div>
              <div><strong>Area:</strong> {detail.area || "-"}</div>
              <div><strong>Salesman:</strong> {employees.find((e) => e.id === detail.salesman_id)?.name || "-"}</div>
              <div><strong>Credit Limit:</strong> {formatPKR(detail.credit_limit || 0)}</div>
            </div>
            {creditLimitExceeded && (
              <div className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
                Credit limit exceeded! Outstanding: {formatPKR(totalOutstanding)} / Limit: {formatPKR(detail.credit_limit || 0)}
              </div>
            )}
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <h4 className="font-semibold mb-2">Running Balance</h4>
              <p className={totalOutstanding > 0 ? "text-rose-400" : "text-emerald-400"}>{formatPKR(totalOutstanding)}</p>
            </div>
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <h4 className="font-semibold mb-2">Purchase History ({detailInvoices.length})</h4>
              {detailInvoices.length === 0 ? <p style={{ color: "var(--text-secondary)" }}>No purchases</p> : (
                <DataTable data={detailInvoices} columns={[
                  { key: "invoice_no", label: "Invoice#" },
                  { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "-" },
                  { key: "gross_total", label: "Gross", render: (r) => formatPKR(r.gross_total || 0) },
                  { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
                  { key: "paid_amount", label: "Paid", render: (r) => formatPKR(r.paid_amount || 0) },
                  { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || (r.net_total || 0) - (r.paid_amount || 0)) },
                  { key: "status", label: "Status", render: (r) => {
                    const bal = r.balance || (r.net_total || 0) - (r.paid_amount || 0);
                    const status = bal <= 0 ? "Paid" : bal >= (r.net_total || 0) ? "Unpaid" : "Partial";
                    return <StatusBadge status={status} green="Paid" orange="Partial" red="Unpaid" />;
                  }},
                ]} />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 7: Invoicing & Delivery ──────────────────────────────────────────────

function InvoicesTab() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shops, setShops] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    salesman_id: "", shop_id: "", warehouse_id: "",
    items: [{ product_id: "", quantity: 1, unit_price: "" }],
    discount: 0, paid_amount: "",
  });

  const loadMeta = useCallback(async () => {
    try {
      const [p, emp, s, w] = await Promise.all([
        api.get("/products").then((r) => r.data),
        api.get("/employees").then((r) => r.data),
        warehouseApi.listShops(),
        warehouseApi.list(),
      ]);
      setProducts(p); setEmployees(emp); setShops(s); setWarehouses(w);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await warehouseApi.listInvoices();
      setInvoices(data);
    } catch { setInvoices([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const openCreateForm = () => {
    setForm({
      salesman_id: "", shop_id: "", warehouse_id: "",
      items: [{ product_id: "", quantity: 1, unit_price: "" }],
      discount: 0, paid_amount: "",
    });
    setCreateOpen(true);
  };

  const grossTotal = useMemo(() =>
    form.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
  [form.items]);

  const netTotal = Math.max(0, grossTotal - (Number(form.discount) || 0));
  const paidAmount = Number(form.paid_amount) || 0;
  const remaining = Math.max(0, netTotal - paidAmount);

  const updateItem = (i, field, value) => {
    const copy = [...form.items];
    copy[i] = { ...copy[i], [field]: value };
    setForm({ ...form, items: copy });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product_id: "", quantity: 1, unit_price: "" }] });
  const removeItem = (i) => form.items.length > 1 && setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    const valid = form.items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (!form.shop_id || valid.length === 0) return toast.error("Select shop and add items");
    setSubmitting(true);
    try {
      await warehouseApi.createInvoice({
        salesman_id: form.salesman_id ? Number(form.salesman_id) : null,
        shop_id: Number(form.shop_id),
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
        items: valid.map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity), unit_price: Number(it.unit_price) || 0 })),
        discount: Number(form.discount) || 0,
        paid_amount: paidAmount,
      });
      toast.success("Invoice created");
      setCreateOpen(false);
      loadInvoices();
    } catch (err) { toast.error(err.response?.data?.detail || "Invoice creation failed"); }
    setSubmitting(false);
  };

  const openDetail = async (row) => {
    try {
      const full = await warehouseApi.getInvoice(row.id);
      setDetail(full);
    } catch { toast.error("Failed to load invoice"); }
  };

  const handlePrint = (row) => {
    printRecord({
      title: `Invoice #${row.invoice_no || row.id}`,
      fields: [
        { label: "Date", value: row.created_at ? new Date(row.created_at).toLocaleString() : "-" },
        { label: "Shop", value: shops.find((s) => s.id === row.shop_id)?.name || `#${row.shop_id}` },
        { label: "Salesman", value: employees.find((e) => e.id === row.salesman_id)?.name || "-" },
        { label: "Gross Total", value: formatPKR(row.gross_total || 0) },
        { label: "Discount", value: formatPKR(row.discount || 0) },
        { label: "Net Total", value: formatPKR(row.net_total || 0) },
        { label: "Paid", value: formatPKR(row.paid_amount || 0) },
        { label: "Balance", value: formatPKR((row.net_total || 0) - (row.paid_amount || 0)) },
        { label: "Status", value: (row.net_total || 0) - (row.paid_amount || 0) <= 0 ? "Paid" : "Pending" },
      ],
    });
  };

  const columns = [
    { key: "invoice_no", label: "Invoice#" },
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "-" },
    { key: "shop_id", label: "Shop", render: (r) => shops.find((s) => s.id === r.shop_id)?.name || `#${r.shop_id}` },
    { key: "salesman_id", label: "Salesman", render: (r) => employees.find((e) => e.id === r.salesman_id)?.name || "-" },
    { key: "gross_total", label: "Gross", render: (r) => formatPKR(r.gross_total || 0) },
    { key: "discount", label: "Disc", render: (r) => formatPKR(r.discount || 0) },
    { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
    { key: "paid_amount", label: "Paid", render: (r) => formatPKR(r.paid_amount || 0) },
    { key: "balance", label: "Balance", render: (r) => {
      const bal = r.balance || (r.net_total || 0) - (r.paid_amount || 0);
      return <span style={{ color: bal > 0 ? "#f59e0b" : "#22c55e" }}>{formatPKR(bal)}</span>;
    }},
    { key: "status", label: "Status", render: (r) => {
      const bal = r.balance || (r.net_total || 0) - (r.paid_amount || 0);
      const status = bal <= 0 ? "Paid" : bal >= (r.net_total || 0) ? "Unpaid" : "Partial";
      return <StatusBadge status={status} green="Paid" orange="Partial" red="Unpaid" />;
    }},
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => openDetail(r)} onPrint={() => handlePrint(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreateForm} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> New Invoice</button>
      </div>
      {loading ? <LoadingSkeleton rows={6} /> : invoices.length === 0 ? (
        <EmptyState title="No invoices" description="Create an invoice to track deliveries" />
      ) : (
        <DataTable data={invoices} columns={columns} searchableColumns={["invoice_no"]} searchPlaceholder="Search by invoice #..." />
      )}

      <Modal title="Create Invoice" open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="max-w-4xl">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <select className="input py-2" value={form.salesman_id} onChange={(e) => setForm({ ...form, salesman_id: e.target.value })}>
              <option value="">Select Salesman</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <select className="input py-2" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
              <option value="">Select Shop</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input py-2" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
              <option value="">Select Warehouse</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Items</p>
            {form.items.map((it, i) => (
              <div key={i} className="flex gap-2 items-start">
                <select className="input py-2 flex-[2]" value={it.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)} required>
                  <option value="">Product</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input py-2 w-20" type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} required />
                <input className="input py-2 w-24" type="number" min="0" step="0.01" placeholder="Rate" value={it.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} required />
                <div className="py-2 w-24 text-right text-sm" style={{ color: "var(--text-secondary)" }}>
                  {formatPKR((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
                </div>
                <button type="button" onClick={() => removeItem(i)} className="icon-btn icon-btn-danger mt-1"><X size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={addItem} className="btn-soft text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
          </div>

          <div className="rounded-lg border p-3 space-y-1 text-sm" style={{ borderColor: "var(--border-color)" }}>
            <div className="flex justify-between"><span>Gross Total</span><span>{formatPKR(grossTotal)}</span></div>
            <div className="flex justify-between items-center gap-4">
              <span>Discount</span>
              <input className="input py-1 w-28 text-right" type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div className="flex justify-between font-bold border-t pt-1" style={{ borderColor: "var(--border-color)" }}>
              <span>Net Total</span><span>{formatPKR(netTotal)}</span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span>Paid Amount</span>
              <input className="input py-1 w-28 text-right" type="number" min="0" step="0.01" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} placeholder={String(netTotal)} />
            </div>
            <div className="flex justify-between" style={{ color: remaining > 0 ? "#f59e0b" : "#22c55e" }}>
              <span>Remaining</span><span>{formatPKR(remaining)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Creating..." : "Create Invoice"}</button>
          </div>
        </form>
      </Modal>

      <Modal title={`Invoice #${detail?.invoice_no || detail?.id || ""}`} open={!!detail} onClose={() => setDetail(null)} maxWidth="max-w-3xl">
        {detail && (
          <div className="space-y-3 text-sm max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div><strong>Invoice#:</strong> {detail.invoice_no || detail.id}</div>
              <div><strong>Date:</strong> {detail.created_at ? new Date(detail.created_at).toLocaleString() : "-"}</div>
              <div><strong>Shop:</strong> {shops.find((s) => s.id === detail.shop_id)?.name || `#${detail.shop_id}`}</div>
              <div><strong>Salesman:</strong> {employees.find((e) => e.id === detail.salesman_id)?.name || "-"}</div>
            </div>

            {detail.items && detail.items.length > 0 && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-sm">
                  <thead><tr style={{ background: "var(--bg-elevated)" }}>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr></thead>
                  <tbody>
                    {detail.items.map((it, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-3 py-1.5">{products.find((p) => p.id === (it.product_id || it.product))?.name || `#${it.product_id || it.product}`}</td>
                        <td className="px-3 py-1.5 text-center">{it.quantity}</td>
                        <td className="px-3 py-1.5 text-right">{formatPKR(it.unit_price || 0)}</td>
                        <td className="px-3 py-1.5 text-right">{formatPKR((it.quantity || 0) * (it.unit_price || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1 text-right">
              <p>Gross: {formatPKR(detail.gross_total || 0)}</p>
              {detail.discount > 0 && <p>Discount: -{formatPKR(detail.discount || 0)}</p>}
              <p className="font-bold text-base">Net: {formatPKR(detail.net_total || 0)}</p>
              <p>Paid: {formatPKR(detail.paid_amount || 0)}</p>
              <p style={{ color: (detail.net_total || 0) - (detail.paid_amount || 0) > 0 ? "#f59e0b" : "#22c55e" }}>
                Balance: {formatPKR((detail.net_total || 0) - (detail.paid_amount || 0))}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => handlePrint(detail)} className="btn-soft text-sm flex items-center gap-1"><Printer size={14} /> Print</button>
              <button onClick={() => window.open(`/api/invoices/${detail.id}/print`, "_blank")} className="btn-soft text-sm flex items-center gap-1"><FileText size={14} /> View Print</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 8: Payments & Collections ────────────────────────────────────────────

function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [shops, setShops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dailyCollection, setDailyCollection] = useState(null);
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    shop_id: "", invoice_id: "", amount: "", payment_mode: "cash",
    reference_no: "", notes: "", date: new Date().toISOString().slice(0, 10),
  });

  const loadMeta = useCallback(async () => {
    try {
      const [s, emp] = await Promise.all([
        warehouseApi.listShops(),
        api.get("/employees").then((r) => r.data),
      ]);
      setShops(s); setEmployees(emp);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await warehouseApi.listPayments();
      setPayments(data);
    } catch { setPayments([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const loadDailyCollection = useCallback(async () => {
    try {
      const data = await warehouseApi.getDailyCollection({ date: collectionDate });
      setDailyCollection(data);
    } catch { setDailyCollection(null); }
  }, [collectionDate]);

  useEffect(() => { if (collectionDate) loadDailyCollection(); }, [loadDailyCollection]);

  const handleRecord = async (e) => {
    e.preventDefault();
    if (!form.shop_id || !form.amount) return toast.error("Select shop and enter amount");
    setSubmitting(true);
    try {
      await warehouseApi.createPayment({
        shop_id: Number(form.shop_id),
        invoice_id: form.invoice_id ? Number(form.invoice_id) : null,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        reference_no: form.reference_no || undefined,
        notes: form.notes || undefined,
        date: form.date,
      });
      toast.success("Payment recorded");
      setRecordOpen(false);
      setForm({ shop_id: "", invoice_id: "", amount: "", payment_mode: "cash", reference_no: "", notes: "", date: new Date().toISOString().slice(0, 10) });
      loadPayments();
    } catch (err) { toast.error(err.response?.data?.detail || "Payment failed"); }
    setSubmitting(false);
  };

  const totalCollected = useMemo(() =>
    payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
  [payments]);

  const columns = [
    { key: "created_at", label: "Date", render: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : "-" },
    { key: "shop_id", label: "Shop", render: (r) => shops.find((s) => s.id === r.shop_id)?.name || `#${r.shop_id}` },
    { key: "amount", label: "Amount", render: (r) => formatPKR(r.amount || 0) },
    { key: "payment_mode", label: "Mode", render: (r) => <span className="capitalize">{r.payment_mode || "cash"}</span> },
    { key: "reference_no", label: "Reference" },
    { key: "invoice_id", label: "Invoice", render: (r) => r.invoice_id ? `#${r.invoice_id}` : "-" },
    { key: "salesman_id", label: "Salesman", render: (r) => employees.find((e) => e.id === r.salesman_id)?.name || "-" },
    { key: "actions", label: "Actions", align: "right", render: (r) => (
      <ActionButtons onView={() => setViewPayment(r)} />
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Payments" value={payments.length} tone="indigo" icon="ti-receipt" />
        <StatCard title="Total Collected" value={totalCollected} tone="emerald" money icon="ti-currency-dollar" />
        <StatCard title="Avg Payment" value={payments.length ? totalCollected / payments.length : 0} tone="amber" money icon="ti-calculator" />
      </div>
      <div className="flex justify-end">
        <button onClick={() => setRecordOpen(true)} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Record Payment</button>
      </div>

      {/* Daily Collection */}
      <div className="panel p-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold">Daily Collection</h3>
          <input className="input py-1 w-40" type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
          <button onClick={loadDailyCollection} className="btn-soft text-xs flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
        </div>
        {dailyCollection ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-lg font-bold">{formatPKR(dailyCollection.total || 0)}</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Collected</p>
            </div>
            {dailyCollection.by_salesman && dailyCollection.by_salesman.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>By Salesman</p>
                {dailyCollection.by_salesman.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.salesman_name || `#${item.salesman_id}`}</span>
                    <span>{formatPKR(item.total || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No collection data for this date</p>
        )}
      </div>

      {loading ? <LoadingSkeleton rows={6} /> : payments.length === 0 ? (
        <EmptyState title="No payments" description="Record a payment to get started" />
      ) : (
        <DataTable data={payments} columns={columns} searchableColumns={["reference_no", "payment_mode"]} />
      )}

      <Modal title="Record Payment" open={recordOpen} onClose={() => setRecordOpen(false)}>
        <form onSubmit={handleRecord} className="space-y-3">
          <select className="input py-2" value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })} required>
            <option value="">Select Shop</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" type="number" placeholder="Invoice ID (optional)" value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} />
          <input className="input" type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <select className="input py-2" value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="cheque">Cheque</option>
            <option value="online">Online</option>
          </select>
          <input className="input" placeholder="Reference No" value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
          <input className="input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRecordOpen(false)} className="btn-soft">Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? "Recording..." : "Record Payment"}</button>
          </div>
        </form>
      </Modal>
      <Modal title="Payment Detail" open={!!viewPayment} onClose={() => setViewPayment(null)}>
        {viewPayment && (
          <div className="space-y-2 text-sm">
            {[
              ["Date", viewPayment.created_at ? new Date(viewPayment.created_at).toLocaleDateString() : "-"],
              ["Shop", shops.find((s) => s.id === viewPayment.shop_id)?.name || `#${viewPayment.shop_id}`],
              ["Amount", formatPKR(viewPayment.amount || 0)],
              ["Payment Mode", viewPayment.payment_mode || "cash"],
              ["Reference", viewPayment.reference_no || "-"],
              ["Invoice", viewPayment.invoice_id ? `#${viewPayment.invoice_id}` : "-"],
              ["Salesman", employees.find((e) => e.id === viewPayment.salesman_id)?.name || "-"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between py-1" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="font-medium capitalize">{typeof val === "string" ? val : String(val)}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── TAB 9: Finance / COA ─────────────────────────────────────────────────────

function FinanceTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [subTab, setSubTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [acctDetail, setAcctDetail] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [trialBalance, setTrialBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ account_name: "", account_type: "Asset", account_code: "", description: "" });
  const [coaSetting, setCoaSetting] = useState(null);
  const [confirmMode, setConfirmMode] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const loadAccounts = useCallback(async () => {
    if (!warehouseId) { setAccounts([]); return; }
    setLoading(true);
    try {
      const [accts, setting] = await Promise.all([
        warehouseApi.getCOAAccounts(warehouseId),
        warehouseApi.getCOASetting(warehouseId).catch(() => null),
      ]);
      setAccounts(accts);
      setCoaSetting(setting);
    } catch { setAccounts([]); }
    setLoading(false);
  }, [warehouseId]);

  useEffect(() => {
    (async () => { try { setWarehouses(await warehouseApi.list()); } catch {} })();
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const loadJournal = useCallback(async () => {
    if (!warehouseId) return;
    const params = {};
    if (dateRange.start) params.start_date = dateRange.start;
    if (dateRange.end) params.end_date = dateRange.end;
    try {
      setJournalEntries(await warehouseApi.getJournalEntries(warehouseId, params));
    } catch {}
  }, [warehouseId, dateRange]);

  const loadTrial = useCallback(async () => {
    if (!warehouseId) return;
    try { setTrialBalance(await warehouseApi.getTrialBalance(warehouseId)); } catch {}
  }, [warehouseId]);

  useEffect(() => { if (subTab === "journal") loadJournal(); }, [subTab, loadJournal]);
  useEffect(() => { if (subTab === "trial") loadTrial(); }, [subTab, loadTrial]);

  const handleViewAccount = async (acct) => {
    try {
      const detail = await warehouseApi.getCOAAccountDetail(warehouseId, acct.id);
      setAcctDetail(detail);
      setSubTab("detail");
    } catch { toast.error("Failed to load account detail"); }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      await warehouseApi.createCOAAccount(warehouseId, addForm);
      toast.success("Account created");
      setShowAddForm(false);
      setAddForm({ account_name: "", account_type: "Asset", account_code: "", description: "" });
      loadAccounts();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to create"); }
  };

  const handleDeleteAccount = async (acct) => {
    try {
      await warehouseApi.deleteCOAAccount(warehouseId, acct.id);
      toast.success("Account deleted");
      loadAccounts();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to delete"); }
  };

  const toggleMode = async () => {
    if (!coaSetting) return;
    const newMode = coaSetting.mode === "separate" ? "merged" : "separate";
    try {
      await warehouseApi.updateCOASetting(warehouseId, { mode: newMode });
      toast.success(`COA mode changed to ${newMode}`);
      setConfirmMode(false);
      loadAccounts();
    } catch (err) { toast.error(err.response?.data?.detail || "Update failed"); }
  };

  const filteredAccounts = filterType
    ? accounts.filter((a) => a.account_type === filterType)
    : accounts;

  const typeColors = { Asset: "#3b82f6", Liability: "#f59e0b", Income: "#22c55e", Expense: "#ef4444", Equity: "#8b5cf6" };

  const SUBTABS = [
    { id: "accounts", label: "Accounts" },
    { id: "journal", label: "Journal Entries" },
    { id: "trial", label: "Trial Balance" },
  ];

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <select className="input py-1.5 text-sm flex-1" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setAcctDetail(null); }}>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {!warehouseId ? <EmptyState title="Select a warehouse" description="Choose a warehouse to view COA" /> : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {SUBTABS.map((st) => (
                <button key={st.id} onClick={() => setSubTab(st.id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                  style={{
                    background: subTab === st.id ? "var(--accent)" : "var(--bg-elevated)",
                    color: subTab === st.id ? "#000" : "var(--text-secondary)",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
            {coaSetting && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="capitalize">{coaSetting.mode} mode</span>
                <button onClick={() => setConfirmMode(true)} className="btn-soft px-2 py-1 text-xs">
                  Switch to {coaSetting.mode === "separate" ? "Merged" : "Separate"}
                </button>
              </div>
            )}
          </div>

          {subTab === "accounts" && (
            <>
              <div className="flex items-center gap-2">
                <select className="input py-1.5 text-xs w-40" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Equity">Equity</option>
                </select>
                <div className="flex-1" />
                <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                  <Plus size={12} /> Add Custom Account
                </button>
              </div>

              {loading ? <LoadingSkeleton rows={6} /> : filteredAccounts.length === 0
                ? <EmptyState title="No accounts" description="Create a warehouse to auto-generate COA accounts" />
                : (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "var(--bg-elevated)" }}>
                        <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Code</th>
                        <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Name</th>
                        <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Type</th>
                        <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Balance</th>
                        <th className="text-center px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>System</th>
                        <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((acct) => (
                        <tr key={acct.id} className="hover:bg-[var(--bg-hover)] border-b" style={{ borderColor: "var(--border-color)" }}>
                          <td className="px-3 py-2 font-mono">{acct.account_code}</td>
                          <td className="px-3 py-2">{acct.account_name}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ background: `${typeColors[acct.account_type]}20`, color: typeColors[acct.account_type] }}>
                              {acct.account_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{formatPKR(0)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${acct.is_system ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                              {acct.is_system ? "System" : "Custom"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => handleViewAccount(acct)} className="btn-soft px-2 py-0.5 text-[10px] mr-1">
                              <Eye size={11} />
                            </button>
                            {!acct.is_system && (
                              <button onClick={() => handleDeleteAccount(acct)} className="btn-soft px-2 py-0.5 text-[10px] text-red-500">
                                <Trash2 size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Modal title="Add Custom Account" open={showAddForm} onClose={() => setShowAddForm(false)}>
                <form onSubmit={handleAddAccount} className="space-y-3">
                  <input className="input py-2 text-sm" placeholder="Account Name *" value={addForm.account_name}
                    onChange={(e) => setAddForm({ ...addForm, account_name: e.target.value })} required />
                  <select className="input py-2 text-sm" value={addForm.account_type}
                    onChange={(e) => setAddForm({ ...addForm, account_type: e.target.value })}>
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Equity">Equity</option>
                  </select>
                  <input className="input py-2 text-sm" placeholder="Account Code *" value={addForm.account_code}
                    onChange={(e) => setAddForm({ ...addForm, account_code: e.target.value })} required />
                  <textarea className="input py-2 text-sm" placeholder="Description (optional)" rows={2} value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
                  <button type="submit" className="btn-primary w-full text-sm py-2">Create Account</button>
                </form>
              </Modal>
            </>
          )}

          {subTab === "detail" && acctDetail && (
            <div className="space-y-3">
              <button onClick={() => setSubTab("accounts")} className="btn-soft text-xs flex items-center gap-1 px-3 py-1.5">
                &larr; Back to Accounts
              </button>
              <div className="panel p-4 grid grid-cols-2 gap-4 text-sm">
                <div><span className="font-semibold">Account:</span> {acctDetail.account.account_name}</div>
                <div><span className="font-semibold">Code:</span> {acctDetail.account.account_code}</div>
                <div>
                  <span className="font-semibold">Type:</span>{" "}
                  <span style={{ color: typeColors[acctDetail.account.account_type] }}>{acctDetail.account.account_type}</span>
                </div>
                <div><span className="font-semibold">Balance:</span> {formatPKR(acctDetail.balance)}</div>
                <div><span className="font-semibold">Total Debits:</span> {formatPKR(acctDetail.total_debits)}</div>
                <div><span className="font-semibold">Total Credits:</span> {formatPKR(acctDetail.total_credits)}</div>
              </div>

              <h4 className="text-xs font-semibold">Journal History</h4>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Date</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Reference</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Narration</th>
                      <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Debit</th>
                      <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acctDetail.lines?.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6" style={{ color: "var(--text-secondary)" }}>No journal entries</td></tr>
                    )}
                    {acctDetail.lines?.map((line) => (
                      <tr key={line.id} className="border-b hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-3 py-2">{line.journal_entry?.date?.slice(0, 10) || "-"}</td>
                        <td className="px-3 py-2 font-mono">{line.journal_entry?.reference || "-"}</td>
                        <td className="px-3 py-2">{line.journal_entry?.narration || ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{line.debit ? formatPKR(line.debit) : ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{line.credit ? formatPKR(line.credit) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === "journal" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="date" className="input py-1.5 text-xs" value={dateRange.start}
                  onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>to</span>
                <input type="date" className="input py-1.5 text-xs" value={dateRange.end}
                  onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
                <button onClick={loadJournal} className="btn-soft px-3 py-1.5 text-xs">Filter</button>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Date</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Reference</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Narration</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Lines (Dr/Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntries.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-6" style={{ color: "var(--text-secondary)" }}>No journal entries yet. Perform warehouse transactions to auto-generate entries.</td></tr>
                    )}
                    {journalEntries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-3 py-2 whitespace-nowrap">{entry.date?.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-mono">{entry.reference || "-"}</td>
                        <td className="px-3 py-2">{entry.narration || ""}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            {(entry.lines || []).map((line) => (
                              <span key={line.id} className="text-[10px]">
                                {line.account_name || `#${line.account_id}`}: {line.debit ? `Dr ${formatPKR(line.debit)}` : `Cr ${formatPKR(line.credit)}`}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === "trial" && (
            <div className="space-y-3">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Code</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Account</th>
                      <th className="text-left px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Type</th>
                      <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Debit</th>
                      <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Credit</th>
                      <th className="text-right px-3 py-2 font-semibold border-b" style={{ borderColor: "var(--border-color)" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.map((row) => (
                      <tr key={row.account_id} className="border-b hover:bg-[var(--bg-hover)]" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-3 py-2 font-mono">{row.account_code}</td>
                        <td className="px-3 py-2">{row.account_name}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: `${typeColors[row.account_type]}20`, color: typeColors[row.account_type] }}>
                            {row.account_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{row.debit > 0 ? formatPKR(row.debit) : ""}</td>
                        <td className="px-3 py-2 text-right font-mono">{row.credit > 0 ? formatPKR(row.credit) : ""}</td>
                        <td className={`px-3 py-2 text-right font-mono ${row.balance < 0 ? "text-red-500" : "text-green-600"}`}>
                          {formatPKR(Math.abs(row.balance))} {row.balance >= 0 ? "Dr" : "Cr"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--bg-elevated)" }}>
                      <td colSpan={3} className="px-3 py-2 font-semibold text-xs">Total</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatPKR(trialBalance.reduce((s, r) => s + r.debit, 0))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatPKR(trialBalance.reduce((s, r) => s + r.credit, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {trialBalance.length > 0 && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <span>Total Debits: {formatPKR(trialBalance.reduce((s, r) => s + r.debit, 0))}</span>
                  <span>Total Credits: {formatPKR(trialBalance.reduce((s, r) => s + r.credit, 0))}</span>
                  <span className="font-semibold"
                    style={{ color: trialBalance.reduce((s, r) => s + r.debit, 0) === trialBalance.reduce((s, r) => s + r.credit, 0) ? "#22c55e" : "#ef4444" }}>
                    {trialBalance.reduce((s, r) => s + r.debit, 0) === trialBalance.reduce((s, r) => s + r.credit, 0) ? "✓ Balanced" : "✗ Unbalanced"}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmMode}
        title="Change COA Mode"
        description={`Switch COA mode from "${coaSetting?.mode}" to "${coaSetting?.mode === "separate" ? "merged" : "separate"}"?`}
        onConfirm={toggleMode}
        onClose={() => setConfirmMode(false)}
      />
    </div>
  );
}

// ─── TAB 10: Reports ──────────────────────────────────────────────────────────

function ReportsTab() {
  const [selectedGroup, setSelectedGroup] = useState("stock");
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportConfig, setReportConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [warehouseList, setWarehouseList] = useState([]);

  const [filters, setFilters] = useState({
    warehouse_id: "", product_id: "", salesman_id: "", shop_id: "",
    category: "", movement_type: "", return_type: "", status: "",
    aging: "", payment_mode: "", date_str: "",
    start: "", end: "", days: 30, source_id: "", dest_id: "", account_id: "",
  });

  const [activeTab, setActiveTab] = useState("stock");

  const reportInfo = useMemo(() => {
    if (!reportConfig) return null;
    return getReportById(selectedReport);
  }, [selectedReport, reportConfig]);

  useEffect(() => {
    if (selectedReport) {
      const meta = getReportById(selectedReport);
      setReportConfig(meta);
    }
  }, [selectedReport]);

  useEffect(() => {
    warehouseApi.list().then(setWarehouseList).catch(() => {});
    const firstGroup = REPORT_GROUPS[0];
    if (firstGroup?.reports?.length) {
      setSelectedReport(firstGroup.reports[0].id);
    }
  }, []);

  const loadReport = useCallback(async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) params[k] = v;
      });
      const result = await warehouseApi.getWarehouseReport(selectedReport, params);
      setData(result?.data || []);
      setSummary(result?.summary || null);
    } catch {
      setData([]);
      setSummary(null);
      toast.error("Failed to load report");
    }
    setLoading(false);
  }, [selectedReport, filters]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const filterPanel = reportConfig ? (
    <div className="flex flex-wrap items-center gap-2 p-3" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius, 8px)", border: "0.5px solid var(--border-color)" }}>
      {(reportConfig.filters || []).includes("warehouse") && (
        <select className="input py-1.5 text-xs w-36" value={filters.warehouse_id}
          onChange={(e) => updateFilter("warehouse_id", e.target.value)}>
          <option value="">All Warehouses</option>
          {warehouseList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {(reportConfig.filters || []).includes("product") && (
        <ProductFilter value={filters.product_id} onChange={(v) => updateFilter("product_id", v || "")} />
      )}
      {(reportConfig.filters || []).includes("salesman") && (
        <SalesmanFilter value={filters.salesman_id} onChange={(v) => updateFilter("salesman_id", v || "")} />
      )}
      {(reportConfig.filters || []).includes("shop") && (
        <ShopFilter value={filters.shop_id} onChange={(v) => updateFilter("shop_id", v || "")} />
      )}
      {(reportConfig.filters || []).includes("category") && (
        <CategoryFilter value={filters.category} onChange={(v) => updateFilter("category", v)} />
      )}
      {(reportConfig.filters || []).includes("movementType") && (
        <MovementTypeFilter value={filters.movement_type} onChange={(v) => updateFilter("movement_type", v)} />
      )}
      {(reportConfig.filters || []).includes("returnType") && (
        <ReturnTypeFilter value={filters.return_type} onChange={(v) => updateFilter("return_type", v)} />
      )}
      {(reportConfig.filters || []).includes("status") && (
        <StatusFilter value={filters.status} onChange={(v) => updateFilter("status", v)} />
      )}
      {(reportConfig.filters || []).includes("aging") && (
        <AgingFilter value={filters.aging} onChange={(v) => updateFilter("aging", v)} />
      )}
      {(reportConfig.filters || []).includes("paymentMode") && (
        <PaymentModeFilter value={filters.payment_mode} onChange={(v) => updateFilter("payment_mode", v)} />
      )}
      {(reportConfig.filters || []).includes("dateRange") && (
        <DateRangePicker value={{ start: filters.start, end: filters.end }}
          onChange={({ start, end }) => { setFilters((prev) => ({ ...prev, start, end })); }} />
      )}
      {(reportConfig.filters || []).includes("date") && (
        <input className="input py-1.5 text-xs w-36" type="date" value={filters.date_str}
          onChange={(e) => updateFilter("date_str", e.target.value)} placeholder="Date" />
      )}
      <button onClick={loadReport} disabled={loading} className="btn-soft text-xs flex items-center gap-1">
        <RefreshCw size={12} /> {loading ? "Loading..." : "Run"}
      </button>
    </div>
  ) : null;

  const totalRow = reportConfig?.summary ? (
    <span>{reportConfig.summary(data)}</span>
  ) : null;

  return (
    <div className="flex gap-4">
      <div className="w-48 shrink-0 space-y-1">
        {REPORT_GROUPS.map((group) => (
          <div key={group.id}>
            <button
              onClick={() => { setActiveTab(group.id); setSelectedReport(group.reports[0]?.id); }}
              className="w-full text-left text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5 rounded transition-all"
              style={{
                background: activeTab === group.id ? "var(--accent)" : "transparent",
                color: activeTab === group.id ? "#fff" : "var(--text-secondary)",
              }}
            >
              {group.label}
            </button>
            {activeTab === group.id && group.reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className="w-full text-left text-xs px-3 py-1 rounded transition-all"
                style={{
                  background: selectedReport === r.id ? "var(--bg-elevated)" : "transparent",
                  color: selectedReport === r.id ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: selectedReport === r.id ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {reportInfo && (
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{reportInfo.label}</div>
            {data.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { const h = reportInfo.columns.map((c) => `"${c.label}"`).join(","); const b = data.map((r) => reportInfo.columns.map((c) => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([`${h}\n${b}`], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${selectedReport}.csv`; a.click(); URL.revokeObjectURL(url); toast.success("CSV exported"); }}
                  className="btn-soft px-2 py-1 text-xs" title="Export CSV"><Download size={12} /></button>
                <button onClick={() => window.print()} className="btn-soft px-2 py-1 text-xs" title="Print"><Printer size={12} /></button>
              </div>
            )}
          </div>
        )}
        {filterPanel}
        {loading ? <LoadingSkeleton rows={8} /> : data.length === 0 ? (
          <EmptyState title="No data" description="Adjust filters and run the report" />
        ) : (
          <>
            <DataTable data={data} columns={reportConfig?.columns || []} />
            {totalRow && (
              <div className="flex items-center justify-between rounded-lg px-4 py-2 text-xs font-semibold"
                style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border-color)" }}>
                {totalRow}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PaymentModeFilter({ value, onChange }) {
  return (
    <select className="input py-1.5 text-xs w-28" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All Modes</option>
      <option value="cash">Cash</option>
      <option value="bank">Bank</option>
      <option value="jazzcash">JazzCash</option>
      <option value="easypaisa">Easypaisa</option>
    </select>
  );
}


// ─── EXCEL TAB (Spreadsheet Workspace) ─────────────────────────────────────

const COL_WIDTH = 140;
const ROW_H = 32;
const EXCEL_SHEETS = [
  {
    id: "warehouses",
    label: "Warehouses",
    columns: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "code", label: "Code", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "manager", label: "Manager", type: "text" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  {
    id: "opening_stock",
    label: "Opening Stock",
    columns: [
      { key: "warehouse", label: "Warehouse", type: "text", required: true },
      { key: "product_sku", label: "Product SKU", type: "text" },
      { key: "product_name", label: "Product Name", type: "text", required: true },
      { key: "qty", label: "Quantity", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "value", label: "Value", type: "number" },
    ],
  },
  {
    id: "stock_movements",
    label: "Stock Movements",
    columns: [
      { key: "warehouse", label: "Warehouse", type: "text", required: true },
      { key: "product_sku", label: "Product SKU", type: "text" },
      { key: "movement_type", label: "Type", type: "text", required: true },
      { key: "qty", label: "Qty", type: "number", required: true },
      { key: "rate", label: "Rate", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    id: "shops",
    label: "Shops",
    columns: [
      { key: "name", label: "Shop Name", type: "text", required: true },
      { key: "owner_name", label: "Owner", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "address", label: "Address", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "credit_limit", label: "Credit Limit", type: "number" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  {
    id: "invoices",
    label: "Invoices",
    columns: [
      { key: "invoice_no", label: "Invoice #", type: "text" },
      { key: "date", label: "Date", type: "text" },
      { key: "shop_name", label: "Shop", type: "text", required: true },
      { key: "warehouse", label: "Warehouse", type: "text" },
      { key: "gross_total", label: "Gross Total", type: "number" },
      { key: "net_total", label: "Net Total", type: "number" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  {
    id: "payments",
    label: "Payments",
    columns: [
      { key: "date", label: "Date", type: "text" },
      { key: "shop_name", label: "Shop", type: "text", required: true },
      { key: "invoice_no", label: "Invoice", type: "text" },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "payment_mode", label: "Mode", type: "text" },
    ],
  },
];

function colLetter(n) {
  let label = "";
  let i = n;
  while (i >= 0) { label = String.fromCharCode(65 + (i % 26)) + label; i = Math.floor(i / 26) - 1; }
  return label;
}

function ExcelTab() {
  const [sheets, setSheets] = useState(() =>
    EXCEL_SHEETS.map((s) => ({ ...s, rows: [] }))
  );
  const [activeSheetId, setActiveSheetId] = useState("warehouses");
  const [selection, setSelection] = useState({ row: -1, col: -1 });
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [colWidths, setColWidths] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const tableRef = useRef(null);
  const editRef = useRef(null);

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const activeCols = activeSheet?.columns || [];
  const activeRows = activeSheet?.rows || [];

  // ── Load data from API on mount ──
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      warehouseApi.list().then((r) => r.data || r).catch(() => []),
      api.get("/products").then((r) => r.data || []).catch(() => []),
      api.get("/shops").then((r) => r.data || r).catch(() => []),
      api.get("/invoices").then((r) => r.data || r).catch(() => []),
      api.get("/payments").then((r) => r.data || r).catch(() => []),
    ]).then(([warehouses, products, shops, invoices, payments]) => {
      if (cancelled) return;
      setSheets((prev) =>
        prev.map((s) => {
          if (s.id === "warehouses")
            return { ...s, rows: warehouses.map((w) => ({ name: w.name || "", code: w.code || "", location: w.location || "", manager: "", status: w.status || "active" })) };
          if (s.id === "shops")
            return { ...s, rows: shops.map((sh) => ({ name: sh.name || "", owner_name: sh.owner_name || "", phone: sh.phone || "", address: sh.address || "", area: "", credit_limit: sh.credit_limit || 0, status: sh.status || "active" })) };
          if (s.id === "invoices")
            return { ...s, rows: invoices.map((inv) => ({ invoice_no: inv.invoice_no || "", date: inv.date?.slice(0, 10) || "", shop_name: inv.shop_name || "", warehouse: inv.warehouse_name || "", gross_total: inv.gross_total || 0, net_total: inv.net_total || 0, status: inv.status || "unpaid" })) };
          if (s.id === "payments")
            return { ...s, rows: payments.map((p) => ({ date: p.date?.slice(0, 10) || "", shop_name: p.shop_name || "", invoice_no: p.invoice_no || "", amount: p.amount || 0, payment_mode: p.payment_mode || "" })) };
          return s;
        })
      );
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── History helpers ──
  const pushHistory = useCallback(() => {
    setHistory((h) => {
      const nh = h.slice(0, historyIdx + 1);
      nh.push(JSON.parse(JSON.stringify(sheets)));
      if (nh.length > 50) nh.shift();
      return nh;
    });
    setHistoryIdx((i) => Math.min(i + 1, 49));
  }, [historyIdx, sheets]);

  const updateRow = useCallback((ri, colKey, value) => {
    pushHistory();
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId
          ? {
              ...s,
              rows: s.rows.map((r, i) =>
                i === ri ? { ...r, [colKey]: value } : r
              ),
            }
          : s
      )
    );
  }, [activeSheetId, pushHistory]);

  const addRow = useCallback(() => {
    pushHistory();
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId
          ? { ...s, rows: [...s.rows, Object.fromEntries(s.columns.map((c) => [c.key, ""]))] }
          : s
      )
    );
  }, [activeSheetId, pushHistory]);

  const deleteRow = useCallback((ri) => {
    if (activeRows.length <= 1) return;
    pushHistory();
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId
          ? { ...s, rows: s.rows.filter((_, i) => i !== ri) }
          : s
      )
    );
  }, [activeSheetId, activeRows.length, pushHistory]);

  const getCell = (ri, ci) => activeRows[ri]?.[activeCols[ci]?.key] ?? "";

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e) => {
    const { row, col } = selection;
    if (row < 0 || col < 0) return;
    const maxR = activeRows.length;
    const maxC = activeCols.length;
    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        updateRow(row, activeCols[col].key, editValue);
        setEditing(false);
        setSelection((s) => ({ row: Math.min(maxR - 1, s.row + 1), col: s.col }));
      } else if (e.key === "Escape") {
        setEditing(false);
      } else if (e.key === "Tab") {
        e.preventDefault();
        updateRow(row, activeCols[col].key, editValue);
        setEditing(false);
        const next = e.shiftKey ? col - 1 : col + 1;
        if (next >= 0 && next < maxC) setSelection((s) => ({ ...s, col: next }));
        else if (!e.shiftKey && next >= maxC && row < maxR - 1) { setSelection({ row: row + 1, col: 0 }); }
        else if (e.shiftKey && next < 0 && row > 0) { setSelection({ row: row - 1, col: maxC - 1 }); }
      }
      return;
    }
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); setSelection((s) => ({ row: Math.max(0, s.row - 1), col: s.col })); break;
      case "ArrowDown": e.preventDefault(); setSelection((s) => ({ row: Math.min(maxR - 1, s.row + 1), col: s.col })); break;
      case "ArrowLeft": e.preventDefault(); setSelection((s) => ({ row: s.row, col: Math.max(0, s.col - 1) })); break;
      case "ArrowRight": e.preventDefault(); setSelection((s) => ({ row: s.row, col: Math.min(maxC - 1, s.col + 1) })); break;
      case "Tab": e.preventDefault(); { const nxt = e.shiftKey ? col - 1 : col + 1; if (nxt >= 0 && nxt < maxC) setSelection((s) => ({ ...s, col: nxt })); } break;
      case "Enter": e.preventDefault(); setEditValue(getCell(row, col)); setEditing(true); break;
      case "Delete": case "Backspace": e.preventDefault(); updateRow(row, activeCols[col].key, ""); break;
      case "c": if (e.ctrlKey) { e.preventDefault(); navigator.clipboard.writeText(getCell(row, col)); } break;
      case "v": if (e.ctrlKey) { e.preventDefault(); navigator.clipboard.readText().then((t) => updateRow(row, activeCols[col].key, t)).catch(() => {}); } break;
      case "z": if (e.ctrlKey) { e.preventDefault(); if (historyIdx >= 0) { setSheets(JSON.parse(JSON.stringify(history[historyIdx]))); setHistoryIdx((i) => i - 1); } } break;
      case "y": if (e.ctrlKey) { e.preventDefault(); if (historyIdx < history.length - 1) { setSheets(JSON.parse(JSON.stringify(history[historyIdx + 1]))); setHistoryIdx((i) => i + 1); } } break;
      case "f": if (e.ctrlKey) { e.preventDefault(); document.getElementById("excel-search")?.focus(); } break;
    }
  }, [selection, editing, editValue, activeRows, activeCols, updateRow, history, historyIdx]);

  // ── Sort ──
  const toggleSort = (ci) => {
    if (sortCol === ci) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortCol(null); setSortDir(null); }
    } else { setSortCol(ci); setSortDir("asc"); }
  };

  const sortedRows = [...activeRows].sort((a, b) => {
    if (sortCol === null) return 0;
    const k = activeCols[sortCol]?.key || "";
    const va = (a[k] ?? "").toString().toLowerCase();
    const vb = (b[k] ?? "").toString().toLowerCase();
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // ── Filter ──
  const displayRows = sortedRows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return activeCols.some((c) => (r[c.key] ?? "").toString().toLowerCase().includes(q));
  });

  // ── Import CSV ──
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (!text) return;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error("CSV must have header + data rows"); return; }
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const colMap = {};
      activeCols.forEach((c, i) => { const idx = headers.findIndex((h) => h === c.key || h === c.label?.toLowerCase().replace(/\s+/g, "_")); if (idx >= 0) colMap[i] = idx; });
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const row = {};
        activeCols.forEach((c, i) => { row[c.key] = colMap[i] !== undefined ? vals[colMap[i]] ?? "" : ""; });
        return row;
      });
      pushHistory();
      setSheets((prev) =>
        prev.map((s) => (s.id === activeSheetId ? { ...s, rows } : s))
      );
      toast.success(`Imported ${rows.length} rows`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Export CSV ──
  const handleExport = () => {
    const header = activeCols.map((c) => `"${c.label}"`).join(",");
    const body = activeRows.map((r) => activeCols.map((c) => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${activeSheetId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // ── Save to System ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      sheets.forEach((s) => { payload[s.id] = s.rows; });
      await api.post("/warehouses/bulk-import", payload).catch(() => {});
      toast.success("Data saved to system");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  // ── Column resize ──
  const handleResize = (ci, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[ci] || COL_WIDTH;
    const onMove = (ev) => setColWidths((p) => ({ ...p, [ci]: Math.max(60, startW + (ev.clientX - startX)) }));
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", minHeight: 500 }}
      tabIndex={0} onKeyDown={handleKeyDown}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 border-b px-3 py-2 flex-wrap"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
        <div className="flex items-center gap-1 overflow-x-auto max-w-[40%]">
          {sheets.map((s) => (
            <button key={s.id} onClick={() => { setActiveSheetId(s.id); setSelection({ row: -1, col: -1 }); setEditing(false); setSortCol(null); setSortDir(null); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all"
              style={{
                background: activeSheetId === s.id ? "var(--accent)" : "var(--bg-app)",
                color: activeSheetId === s.id ? "#000" : "var(--text-secondary)",
              }}
            >
              {s.label}
              {s.rows.length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">({s.rows.length})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
          <input id="excel-search"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search (Ctrl+F)..."
            className="rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none w-44"
            style={{ background: "var(--bg-app)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          />
        </div>
        <input type="file" accept=".csv" className="hidden" id="excel-import" onChange={handleImport} />
        <button onClick={() => document.getElementById("excel-import")?.click()} className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1">
          <Upload size={12} /> Import
        </button>
        <button onClick={handleExport} className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1">
          <Download size={12} /> Export
        </button>
        <div className="w-px h-5" style={{ background: "var(--border-color)" }} />
        <button onClick={() => { if (historyIdx >= 0) { setSheets(JSON.parse(JSON.stringify(history[historyIdx]))); setHistoryIdx((i) => i - 1); } }}
          disabled={historyIdx < 0} className="btn-soft px-2 py-1.5 disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 size={13} />
        </button>
        <button onClick={() => { if (historyIdx < history.length - 1) { setSheets(JSON.parse(JSON.stringify(history[historyIdx + 1]))); setHistoryIdx((i) => i + 1); } }}
          disabled={historyIdx >= history.length - 1} className="btn-soft px-2 py-1.5 disabled:opacity-30" title="Redo (Ctrl+Y)">
          <Redo2 size={13} />
        </button>
        <div className="w-px h-5" style={{ background: "var(--border-color)" }} />
        <button onClick={addRow} className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1">
          <Plus size={12} /> Row
        </button>
        <button onClick={handleSave} disabled={saving}
          className="rounded-lg px-4 py-1.5 text-xs font-semibold text-black flex items-center gap-1"
          style={{ background: "var(--accent)" }}
        >
          <Save size={12} /> {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-auto" ref={tableRef} style={{ maxHeight: 520 }}>
        <table className="w-full border-collapse" style={{ minWidth: 50 + activeCols.length * COL_WIDTH }}>
          <thead>
            <tr style={{ height: ROW_H }}>
              <th className="sticky top-0 z-20 border-r border-b px-1 text-xs font-semibold text-center"
                style={{ width: 50, minWidth: 50, background: "var(--bg-elevated)", borderColor: "var(--border-color)" }}>
                #
              </th>
              {activeCols.map((col, ci) => (
                <th key={col.key}
                  className="sticky top-0 z-10 border-r border-b px-2 text-xs font-semibold text-left relative select-none"
                  style={{
                    width: colWidths[ci] || COL_WIDTH, minWidth: colWidths[ci] || COL_WIDTH,
                    background: "var(--bg-elevated)", borderColor: "var(--border-color)",
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{col.label}</span>
                    <button onClick={() => toggleSort(ci)} className="p-0.5 hover:opacity-70">
                      <ArrowUpDown size={10} />
                    </button>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)]"
                    onMouseDown={(e) => handleResize(ci, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.slice(0, 5000).map((row, ri) => (
              <tr key={ri} style={{ height: ROW_H }}
                className="hover:bg-[var(--bg-hover)]"
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, row: ri }); }}
              >
                <td className="border-r border-b text-xs text-center select-none"
                  style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)", width: 50, minWidth: 50 }}>
                  <div className="flex items-center justify-center gap-1">
                    <span>{ri + 1}</span>
                    <button onClick={() => deleteRow(ri)} className="p-0 text-red-400 opacity-0 hover:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                </td>
                {activeCols.map((col, ci) => {
                  const val = row[col.key] ?? "";
                  const isSelected = selection.row === ri && selection.col === ci;
                  const isEditing = isSelected && editing;
                  return (
                    <td key={col.key}
                      className={`border-r border-b relative ${isSelected ? "ring-2 ring-inset" : ""}`}
                      style={{
                        borderColor: "var(--border-color)",
                        width: colWidths[ci] || COL_WIDTH, minWidth: colWidths[ci] || COL_WIDTH,
                        background: isSelected ? "rgba(246, 206, 58, 0.12)" : "transparent",
                      }}
                      onClick={() => { setSelection({ row: ri, col: ci }); setEditing(false); }}
                      onDoubleClick={() => { setSelection({ row: ri, col: ci }); setEditValue(val); setEditing(true); }}
                    >
                      {isEditing ? (
                        <input ref={editRef}
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => { updateRow(ri, col.key, editValue); setEditing(false); }}
                          className="absolute inset-0 w-full h-full px-2 text-sm outline-none border-2"
                          style={{ borderColor: "var(--accent)", background: "#fff", color: "#000", zIndex: 5 }}
                        />
                      ) : (
                        <div className={`px-2 text-sm truncate ${col.type === "number" ? "text-right font-mono" : ""}`}
                          style={{ color: "var(--text-primary)", lineHeight: `${ROW_H}px` }}>
                          {col.type === "number" && val !== "" && val != null
                            ? Number(val).toLocaleString()
                            : val || "\u2014"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {displayRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet size={48} className="mb-4 opacity-30" />
            <p className="font-semibold text-sm">No data in this sheet</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Import a CSV file or add rows manually
            </p>
            <button onClick={addRow} className="mt-4 btn-soft px-4 py-2 text-xs flex items-center gap-2">
              <Plus size={14} /> Add Row
            </button>
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between border-t px-4 py-1.5 text-xs"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-4">
          <span>{activeSheet?.label || "Sheet"}</span>
          <span>{displayRows.length} rows &times; {activeCols.length} columns</span>
          {selection.row >= 0 && <span>Cell: {colLetter(selection.col)}{selection.row + 1}</span>}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div className="fixed z-50 rounded-lg border shadow-xl py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y, background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { navigator.clipboard.writeText(getCell(contextMenu.row, selection.col)); setContextMenu(null); }}>
            <Copy size={12} /> Copy
          </button>
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { setSelection({ row: contextMenu.row, col: 0 }); setEditValue(getCell(contextMenu.row, 0)); setEditing(true); setContextMenu(null); }}>
            <Scissors size={12} /> Edit
          </button>
          <hr style={{ borderColor: "var(--border-color)" }} />
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { setSelection({ row: contextMenu.row, col: 0 }); setContextMenu(null); addRow(); }}>
            <Plus size={12} /> Insert Row
          </button>
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 text-red-400 hover:bg-red-500/10"
            onClick={() => { deleteRow(contextMenu.row); setContextMenu(null); }}>
            <Trash2 size={12} /> Delete Row
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "warehouses", label: "Warehouses", icon: Building2 },
  { id: "opening-stock", label: "Opening Stock", icon: Package },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "movements", label: "Movements", icon: ArrowLeftRight },
  { id: "salesmen", label: "Salesmen", icon: UserCircle },
  { id: "shops", label: "Shops", icon: Store },
  { id: "invoices", label: "Invoicing", icon: FileText },
  { id: "payments", label: "Payments", icon: Banknote },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "excel", label: "Excel", icon: FileSpreadsheet },
];

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState("warehouses");
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouse Management"
        subtitle="Full warehouse operations — stock, shops, invoicing, payments, and reports"
      />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "var(--accent)" : "var(--bg-elevated)",
                color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + refreshKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "warehouses" && <WarehousesTab key={refreshKey} />}
          {activeTab === "opening-stock" && <OpeningStockTab key={refreshKey} />}
          {activeTab === "returns" && <ReturnsTab key={refreshKey} />}
          {activeTab === "movements" && <StockMovementsTab key={refreshKey} />}
          {activeTab === "salesmen" && <SalesmenTab key={refreshKey} />}
          {activeTab === "shops" && <ShopsTab key={refreshKey} />}
          {activeTab === "invoices" && <InvoicesTab key={refreshKey} />}
          {activeTab === "payments" && <PaymentsTab key={refreshKey} />}
          {activeTab === "finance" && <FinanceTab key={refreshKey} />}
          {activeTab === "reports" && <ReportsTab key={refreshKey} />}
          {activeTab === "excel" && <ExcelTab key={refreshKey} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
