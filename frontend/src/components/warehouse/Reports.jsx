import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import api from "../../api/client";
import { DataTable, EmptyState, LoadingSkeleton } from "../UI";

export default function Reports() {
  const [summary, setSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ls] = await Promise.all([
        warehouseApi.warehouseSummary(),
        warehouseApi.lowStock(),
      ]);
      setSummary(s);
      setLowStock(ls);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportData = async (dataType, fmt = "csv") => {
    try {
      const res = await api.get(`/io/export/${dataType}`, { params: { format: fmt }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = `${dataType}_${new Date().toISOString().slice(0, 10)}.${fmt}`;
      a.click();
      toast.success("Export started");
    } catch {
      toast.error("Export failed");
    }
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Warehouse Summary</h3>
          {summary.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <DataTable
              data={summary}
              columns={[
                { key: "name", label: "Warehouse" },
                { key: "code", label: "Code" },
                { key: "total_products", label: "Products" },
                { key: "total_quantity", label: "Total Qty" },
              ]}
            />
          )}
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Low Stock Items</h3>
            <button onClick={() => exportData("warehouse_stock")} className="btn-soft text-xs flex items-center gap-1">
              <Download size={12} /> CSV
            </button>
          </div>
          {lowStock.length === 0 ? (
            <EmptyState title="No low stock items" />
          ) : (
            <DataTable
              data={lowStock}
              columns={[
                { key: "product_id", label: "Product ID" },
                { key: "quantity", label: "Qty" },
                { key: "reorder_level", label: "Reorder At" },
              ]}
            />
          )}
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Export Options</h3>
          <div className="flex gap-2">
            <button onClick={() => exportData("warehouse_stock")} className="btn-soft text-xs flex items-center gap-1">
              <Download size={12} /> Stock CSV
            </button>
            <button onClick={() => exportData("warehouse_stock", "xlsx")} className="btn-soft text-xs flex items-center gap-1">
              <Download size={12} /> Stock Excel
            </button>
            <button onClick={() => warehouseApi.calculateClosing().then(() => toast.success("Closing calculated")).catch(() => toast.error("Failed"))}
              className="btn-soft text-xs">
              Calculate Closing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
