import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import { DataTable, LoadingSkeleton, Modal } from "../UI";

export default function CycleCountDialog({ open, onClose, onSaved }) {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [count, setCount] = useState(null);
  const [step, setStep] = useState("select"); // select | count | complete
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("select");
      setCount(null);
      warehouseApi.list().then(setWarehouses).catch(() => {});
    }
  }, [open]);

  const startCount = async () => {
    if (!warehouseId) return toast.error("Select a warehouse");
    setLoading(true);
    try {
      const cc = await warehouseApi.createCycleCount(Number(warehouseId));
      setCount(cc);
      setStep("count");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create cycle count");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId, countedQty) => {
    try {
      const updated = await warehouseApi.updateCycleCountItem(count.id, itemId, Number(countedQty));
      setCount((prev) => ({
        ...prev,
        items: prev.items.map((it) => it.id === itemId ? updated : it),
      }));
    } catch { /* ignore */ }
  };

  const completeCount = async () => {
    if (!count) return;
    setSubmitting(true);
    try {
      await warehouseApi.completeCycleCount(count.id, { allow_negative: false });
      toast.success("Cycle count completed");
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to complete cycle count");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Cycle Count" open={open} onClose={onClose} maxWidth="max-w-3xl">
      {step === "select" && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Select a warehouse to begin cycle counting. The system will create a draft with current stock levels.
          </p>
          <select className="input py-2 w-full" value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)} required>
            <option value="">Select Warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-soft">Cancel</button>
            <button onClick={startCount} className="btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Start Count"}
            </button>
          </div>
        </div>
      )}

      {step === "count" && count && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Cycle Count #{count.id} — Enter actual counts below</p>
          <DataTable
            data={count.items || []}
            columns={[
              { key: "product_id", label: "Product ID" },
              { key: "system_qty", label: "System Qty" },
              {
                key: "counted_qty", label: "Counted Qty",
                render: (row) => (
                  <input
                    className="input py-1 w-20 text-center"
                    type="number" min="0"
                    defaultValue={row.counted_qty}
                    onBlur={(e) => updateItem(row.id, e.target.value)}
                  />
                ),
              },
              { key: "variance", label: "Variance" },
            ]}
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-soft">Close</button>
            <button onClick={completeCount} className="btn-primary" disabled={submitting}>
              {submitting ? "Completing..." : "Complete Count"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
