import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PageHeader } from "../../components/UI";

const URGENCY_COLOR = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-green-600",
};

export default function LowStockDetailPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState("");

  useEffect(() => {
    api
      .get("/ai/reorder")
      .then((r) => {
        setItems(r.data.data || r.data.items || []);
        setInsight(r.data.insight || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => navigate("/ai-intelligence")}>
          ← Analytics
        </button>
        <PageHeader title="Low Stock Alerts" subtitle={insight || "Products that need restocking."} />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="panel text-sm text-[var(--text-muted)]">No low stock items detected.</div>
      ) : (
        <div className="panel overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
                <th className="py-2 pr-4 font-semibold">Product</th>
                <th className="py-2 pr-4 font-semibold">Current Stock</th>
                <th className="py-2 pr-4 font-semibold">Reorder Point</th>
                <th className="py-2 pr-4 font-semibold">Recommended Qty</th>
                <th className="py-2 pr-4 font-semibold">Days Until Stockout</th>
                <th className="py-2 pr-4 font-semibold">Urgency</th>
                <th className="py-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                  <td className="py-2 pr-4 font-medium">{item.product_name}</td>
                  <td className="py-2 pr-4">{item.current_stock ?? "—"}</td>
                  <td className="py-2 pr-4">{item.reorder_point ?? "—"}</td>
                  <td className="py-2 pr-4">{item.recommended_qty ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {item.days_until_stockout != null ? `${item.days_until_stockout}d` : "—"}
                  </td>
                  <td className={`py-2 pr-4 font-semibold capitalize ${URGENCY_COLOR[item.urgency] || ""}`}>
                    {item.urgency ?? "—"}
                  </td>
                  <td className="py-2 text-xs text-[var(--text-muted)]">
                    {item.reasoning || "Stock below reorder threshold"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
