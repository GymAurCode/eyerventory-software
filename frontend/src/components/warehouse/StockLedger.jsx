import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import api from "../../api/client";
import { DataTable, EmptyState, LoadingSkeleton } from "../UI";

export default function StockLedger() {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ product_id: "", warehouse_id: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.product_id) params.product_id = Number(filters.product_id);
      if (filters.warehouse_id) params.warehouse_id = Number(filters.warehouse_id);
      const data = await warehouseApi.stockLedger(params);
      setLedger(data);
    } catch {
      toast.error("Failed to load stock ledger");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap gap-2 p-3">
        <select className="input py-1.5 text-sm" value={filters.product_id}
          onChange={(e) => setFilters((f) => ({ ...f, product_id: e.target.value }))}>
          <option value="">All Products</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input py-1.5 text-sm" value={filters.warehouse_id}
          onChange={(e) => setFilters((f) => ({ ...f, warehouse_id: e.target.value }))}>
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSkeleton rows={10} />
      ) : ledger.length === 0 ? (
        <EmptyState title="No ledger entries" description="Stock movements will appear here" />
      ) : (
        <DataTable
          data={ledger}
          searchableColumns={["description"]}
          searchPlaceholder="Search ledger..."
          columns={[
            { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString() },
            { key: "transaction_type", label: "Type" },
            { key: "product_id", label: "Product ID" },
            { key: "quantity", label: "Qty" },
            { key: "balance_before", label: "Before" },
            { key: "balance_after", label: "After" },
            { key: "unit_price", label: "Unit Price", render: (r) => r.unit_price ? `$${r.unit_price.toFixed(2)}` : "-" },
            { key: "description", label: "Description" },
          ]}
        />
      )}
    </div>
  );
}
