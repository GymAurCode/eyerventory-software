import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PageHeader } from "../../components/UI";

const SEVERITY_COLOR = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

const TYPE_LABEL = {
  sales_spike: "Sales Spike",
  sales_drop: "Sales Drop",
  negative_stock: "Negative Stock",
  duplicate_entry: "Duplicate Entry",
  similar_name: "Similar Name",
};

const INTEGRITY_TYPES = new Set(["negative_stock", "duplicate_entry", "similar_name"]);

export default function AnomalyDetailPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState("");

  useEffect(() => {
    api
      .get("/ai/anomaly")
      .then((r) => {
        setItems(r.data.data || r.data.items || []);
        setInsight(r.data.insight || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const salesAnomalies = items.filter((a) => !INTEGRITY_TYPES.has(a.anomaly_type));
  const integrityIssues = items.filter((a) => INTEGRITY_TYPES.has(a.anomaly_type));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => navigate("/ai-intelligence")}>
          ← Analytics
        </button>
        <PageHeader title="Anomaly Detection" subtitle={insight || "Detected anomalies and data integrity issues."} />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="panel text-sm text-[var(--text-muted)]">No anomalies detected. All data looks clean.</div>
      ) : (
        <>
          {/* Data Integrity Issues */}
          {integrityIssues.length > 0 && (
            <section className="panel space-y-3">
              <p className="text-sm font-semibold">Data Integrity Issues</p>
              <div className="space-y-2">
                {integrityIssues.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-3 text-sm"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[item.severity] || ""}`}>
                        {TYPE_LABEL[item.anomaly_type] || item.anomaly_type}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[item.severity] || ""}`}>
                        {item.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{item.explanation}</p>
                    {item.duplicate_ids && (
                      <p className="mt-1 text-xs">
                        IDs: {item.duplicate_ids.join(", ")} — Names: {item.duplicate_names?.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sales Anomalies */}
          {salesAnomalies.length > 0 && (
            <section className="panel overflow-auto">
              <p className="mb-3 text-sm font-semibold">Sales Anomalies</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
                    <th className="py-2 pr-4 font-semibold">Product</th>
                    <th className="py-2 pr-4 font-semibold">Type</th>
                    <th className="py-2 pr-4 font-semibold">Severity</th>
                    <th className="py-2 pr-4 font-semibold">Z-Score</th>
                    <th className="py-2 pr-4 font-semibold">Deviation</th>
                    <th className="py-2 pr-4 font-semibold">Latest Qty</th>
                    <th className="py-2 pr-4 font-semibold">Rolling Mean</th>
                    <th className="py-2 font-semibold">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {salesAnomalies.map((item, i) => (
                    <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                      <td className="py-2 pr-4 font-medium">{item.product_name}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[item.severity] || ""}`}>
                          {TYPE_LABEL[item.anomaly_type] || item.anomaly_type}
                        </span>
                      </td>
                      <td className={`py-2 pr-4 font-semibold capitalize ${item.severity === "high" ? "text-red-500" : "text-amber-500"}`}>
                        {item.severity}
                      </td>
                      <td className="py-2 pr-4">{item.z_score}</td>
                      <td className="py-2 pr-4">{item.deviation_value}</td>
                      <td className="py-2 pr-4">{item.latest_quantity ?? "—"}</td>
                      <td className="py-2 pr-4">{item.rolling_mean ?? "—"}</td>
                      <td className="py-2">{item.current_stock ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
