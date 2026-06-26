import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import api from "../../api/client";
import { Modal } from "../UI";

function emptyRow() { return { product_id: "", quantity: 1, unit_price: "", notes: "" }; }

export default function StockInDialog({ open, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [items, setItems] = useState([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([
        api.get("/products").then((r) => r.data),
        warehouseApi.list(),
      ]);
      setProducts(p);
      setWarehouses(w);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open) loadMeta(); }, [open, loadMeta]);

  const addRow = () => setItems([...items, emptyRow()]);
  const removeRow = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: value };
    setItems(copy);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) return toast.error("Select a warehouse");
    const valid = items.filter((it) => it.product_id && Number(it.quantity) > 0);
    if (valid.length === 0) return toast.error("Add at least one item");
    setSubmitting(true);
    try {
      const payload = valid.map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price) || 0,
        notes: it.notes,
      }));
      await warehouseApi.stockIn(Number(warehouseId), payload);
      toast.success("Stock-in recorded");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Stock-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Stock In" open={open} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <select className="input py-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <select
                className="input py-2 flex-1"
                value={it.product_id} onChange={(e) => updateRow(i, "product_id", e.target.value)} required
              >
                <option value="">Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku || "N/A"})
                  </option>
                ))}
              </select>
              <input className="input py-2 w-20" type="number" min="1" value={it.quantity}
                onChange={(e) => updateRow(i, "quantity", e.target.value)} required />
              <input className="input py-2 w-28" type="number" min="0" step="0.01" value={it.unit_price}
                placeholder="Price" onChange={(e) => updateRow(i, "unit_price", e.target.value)} />
              <input className="input py-2 w-28" value={it.notes} placeholder="Notes"
                onChange={(e) => updateRow(i, "notes", e.target.value)} />
              <button type="button" onClick={() => removeRow(i)} className="icon-btn icon-btn-danger mt-1">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow} className="btn-soft text-sm flex items-center gap-1">
          <Plus size={14} /> Add Item
        </button>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-soft">Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Recording..." : "Stock In"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
