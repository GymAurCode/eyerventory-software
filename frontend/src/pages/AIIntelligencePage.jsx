import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";

export default function AIIntelligencePage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [reorders, setReorders] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  const [queryInput, setQueryInput] = useState("show slow moving items");
  const [queryResult, setQueryResult] = useState(null);
  const [queryLoading, setQueryLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.post("/ai/predict", { horizon_days: 14 }),
      api.get("/ai/reorder"),
      api.get("/ai/anomaly"),
    ])
      .then(([p, r, a]) => {
        setPredictions(p.data.data || p.data.items || []);
        setReorders(r.data.data || r.data.items || []);
        setAnomalies(a.data.data || a.data.items || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lowStockCount = reorders.length;
  const riskyPredictions = useMemo(
    () => predictions.filter((p) => p.days_until_stockout !== null && p.days_until_stockout <= 14).length,
    [predictions]
  );
  const anomalyCount = anomalies.length;

  const runQuery = async () => {
    if (!queryInput.trim()) return;
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const res = await api.post("/ai/query", { question: queryInput });
      setQueryResult(res.data);
    } catch (err) {
      setQueryResult({ error: err?.response?.data?.detail || "Query failed" });
    } finally {
      setQueryLoading(false);
    }
  };

  const handleQueryKey = (e) => {
    if (e.key === "Enter") runQuery();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics Intelligence"
        subtitle="Real-time inventory monitoring, anomaly detection, and data integrity."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="cursor-pointer" onClick={() => navigate("/ai-intelligence/low-stock")}>
          <StatCard title="Low Stock Alerts" value={loading ? "…" : lowStockCount} tone="rose" icon="ti-alert-triangle" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/ai-intelligence/predictions-risk")}>
          <StatCard title="Predictions at Risk (14d)" value={loading ? "…" : riskyPredictions} tone="amber" icon="ti-alert-octagon" />
        </div>
        <div className="cursor-pointer" onClick={() => navigate("/ai-intelligence/anomalies")}>
          <StatCard title="Anomalies Detected" value={loading ? "…" : anomalyCount} tone="indigo" icon="ti-bug" />
        </div>
      </div>

      {/* Natural Language Query */}
      <section className="panel space-y-3">
        <p className="text-sm font-semibold">Natural Language Query</p>
        <p className="text-xs text-[var(--text-muted)]">
          Try: "show slow moving items", "low stock", "top selling", "no sales", "recent sales", "expenses"
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={handleQueryKey}
            placeholder="Ask a question about your inventory…"
          />
          <button className="btn-primary" onClick={runQuery} disabled={queryLoading}>
            {queryLoading ? "…" : "Run"}
          </button>
        </div>

        {queryResult?.error && <p className="text-xs text-red-500">{queryResult.error}</p>}

        {queryResult && !queryResult.error && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">{queryResult.explanation}</p>
            {queryResult.rows?.length > 0 ? (
              <div className="overflow-auto rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                      {Object.keys(queryResult.rows[0]).map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-semibold capitalize">
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResult.rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2">{val ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No results found.</p>
            )}
          </div>
        )}
      </section>

      {/* Quick summary tables */}
      <div className="grid gap-4 lg:grid-cols-3">
        <QuickTable
          title="Low Stock"
          items={reorders.slice(0, 5)}
          cols={["product_name", "current_stock", "urgency"]}
          onViewAll={() => navigate("/ai-intelligence/low-stock")}
        />
        <QuickTable
          title="Predictions at Risk"
          items={predictions.filter((p) => p.days_until_stockout !== null && p.days_until_stockout <= 14).slice(0, 5)}
          cols={["product_name", "days_until_stockout", "urgency"]}
          onViewAll={() => navigate("/ai-intelligence/predictions-risk")}
        />
        <QuickTable
          title="Anomalies"
          items={anomalies.slice(0, 5)}
          cols={["product_name", "anomaly_type", "severity"]}
          onViewAll={() => navigate("/ai-intelligence/anomalies")}
        />
      </div>
    </div>
  );
}

function QuickTable({ title, items, cols, onViewAll }) {
  return (
    <div className="panel space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button className="text-xs text-[var(--accent)] hover:underline" onClick={onViewAll}>
          View all →
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">No items.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
              {cols.map((c) => (
                <th key={c} className="py-1 text-left font-semibold capitalize">
                  {c.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                {cols.map((c) => (
                  <td key={c} className="py-1 pr-2">
                    {item[c] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
