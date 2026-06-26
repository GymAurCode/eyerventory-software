import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Building2, Eye, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { warehouseApi } from "../../api/warehouse";
import api from "../../api/client";
import { DataTable, EmptyState, LoadingSkeleton, StatCard } from "../UI";

export default function WarehouseDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [selectedWh, setSelectedWh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ls, t] = await Promise.all([
        warehouseApi.warehouseSummary(),
        warehouseApi.lowStock(),
        warehouseApi.transactions({ limit: 20 }),
      ]);
      setSummary(s);
      setLowStock(ls);
      setTransactions(t);
      const ss = await warehouseApi.stockSummary(selectedWh);
      setStockSummary(ss);
    } catch {
      toast.error("Failed to load warehouse data");
    } finally {
      setLoading(false);
    }
  }, [selectedWh]);

  useEffect(() => { load(); }, [load]);

  const totalProducts = useMemo(() =>
    summary.reduce((a, b) => a + (b.total_products || 0), 0), [summary]);
  const totalQty = useMemo(() =>
    summary.reduce((a, b) => a + (b.total_quantity || 0), 0), [summary]);

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Warehouses" value={summary.length} icon={Building2} tone="indigo" />
        <StatCard title="Total Products" value={totalProducts} icon={Package} tone="emerald" />
        <StatCard title="Total Stock Qty" value={totalQty} icon={Eye} tone="amber" />
        <StatCard title="Low Stock Items" value={lowStock.length} icon={AlertTriangle} tone="rose" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Warehouses</h3>
          {summary.length === 0 ? (
            <EmptyState title="No warehouses" description="Create a warehouse first" />
          ) : (
            <div className="space-y-2">
              {summary.map((wh) => (
                <button
                  key={wh.id}
                  onClick={() => setSelectedWh(wh.id === selectedWh ? null : wh.id)}
                  className="w-full rounded-lg border p-3 text-left text-sm transition-all hover:bg-[var(--bg-elevated)]"
                  style={{ borderColor: selectedWh === wh.id ? "var(--accent)" : "var(--border-color)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{wh.name}</span>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {wh.code || ""}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>{wh.total_products} products</span>
                    <span>{wh.total_quantity} units</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-4">
          <h3 className="mb-3 text-sm font-semibold">Stock Summary</h3>
          {stockSummary.length === 0 ? (
            <EmptyState title="Select a warehouse" description="Click a warehouse to view stock" />
          ) : (
            <DataTable
              data={stockSummary.slice(0, 20)}
              searchableColumns={["product_name", "sku"]}
              searchPlaceholder="Search stock..."
              columns={[
                { key: "product_name", label: "Product" },
                { key: "sku", label: "SKU" },
                { key: "quantity", label: "Qty" },
                {
                  key: "low_stock", label: "Status",
                  render: (r) => r.low_stock ? (
                    <span className="text-xs text-rose-400">Low Stock</span>
                  ) : (
                    <span className="text-xs text-emerald-400">OK</span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>

      <div className="panel p-4">
        <h3 className="mb-3 text-sm font-semibold">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <DataTable
            data={transactions}
            columns={[
              { key: "transaction_no", label: "TXN #" },
              { key: "transaction_type", label: "Type" },
              { key: "reference_no", label: "Reference" },
              { key: "created_at", label: "Date", render: (r) => new Date(r.created_at).toLocaleString() },
            ]}
          />
        )}
      </div>
    </div>
  );
}
