import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import api from "../../api/client";
import { Modal } from "../UI";

export default function DamageDialog({ open, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId || !productId) return toast.error("Fill all required fields");
    setSubmitting(true);
    try {
      await warehouseApi.reportDamage(Number(warehouseId), {
        product_id: Number(productId),
        quantity: Number(quantity),
        reason: reason || undefined,
      });
      toast.success("Damage reported");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to report damage");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Report Damage" open={open} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <select className="input py-2 w-full" value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="">Select Warehouse</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <select className="input py-2 w-full" value={productId}
          onChange={(e) => setProductId(e.target.value)} required>
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku || "N/A"})</option>
          ))}
        </select>

        <input className="input py-2 w-full" type="number" min="1" value={quantity}
          placeholder="Quantity" onChange={(e) => setQuantity(e.target.value)} required />

        <input className="input py-2 w-full" value={reason} placeholder="Reason (optional)"
          onChange={(e) => setReason(e.target.value)} />

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-soft">Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Reporting..." : "Report Damage"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
