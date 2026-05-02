import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PageHeader } from "../../components/UI";

export default function PredictionsRiskPage() {
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState("");

  useEffect(() => {
    api
      .post("/ai/predict", { horizon_days: 14 })
      .then((r) => {
        setPredictions(r.data.data || r.data.items || []);
        setInsight(r.data.insight || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const atRisk = useMemo(
    () => predictions.filter((p) => p.days_until_stockout !== null && p.days_until_stockout <= 14),
    [predictions]
  );
  const safe = useMemo(
    () => predictions.filter((p) => p.days_until_stockout === null || p.days_until_stockout > 14),
    [predictions]
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className="text-xs text-[var(--text-muted)] hover:underline" onClick={() => navigate("/ai-intelligence")}>
          ← Analytics
        </button>
        <PageHeader
          title="Predictions at Risk (14d)"
          subtitle={insight || "Products likely to run out within 14 days based on demand trends."}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : predictions.length === 0 ? (
        <div className="panel text-sm text-[var(--text-muted)]">No prediction data available.</div>
      ) : (
        <>
          {atRisk.length > 0 && (
            <section className="panel overflow-auto">
              <p className="mb-3 text-sm font-semibold text-red-500">
                At Risk — {atRisk.length} product{atRisk.length !== 1 ? "s" : ""}
              </p>
              <PredictionTable items={atRisk} />
            </section>
          )}

          {safe.length > 0 && (
            <section className="panel overflow-auto">
              <p className="mb-3 text-sm font-semibold text-green-600">
                Stable — {safe.length} product{safe.length !== 1 ? "s" : ""}
              </p>
              <PredictionTable items={safe} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PredictionTable({ items }) {
  const urgency = (days) => {
    if (days == null) return { label: "—", cls: "" };
    if (days <= 5) return { label: "High", cls: "text-red-500" };
    if (days <= 14) return { label: "Medium", cls: "text-amber-500" };
    return { label: "Low", cls: "text-green-600" };
  };

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
          <th className="py-2 pr-4 font-semibold">Product</th>
          <th className="py-2 pr-4 font-semibold">Current Stock</th>
          <th className="py-2 pr-4 font-semibold">Daily Demand</th>
          <th className="py-2 pr-4 font-semibold">Days Until Stockout</th>
          <th className="py-2 pr-4 font-semibold">Urgency</th>
          <th className="py-2 font-semibold">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const u = urgency(item.days_until_stockout);
          return (
            <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
              <td className="py-2 pr-4 font-medium">{item.product_name}</td>
              <td className="py-2 pr-4">{item.current_stock ?? "—"}</td>
              <td className="py-2 pr-4">
                {item.daily_demand != null ? item.daily_demand.toFixed(2) : "—"}
              </td>
              <td className="py-2 pr-4">
                {item.days_until_stockout != null ? `${item.days_until_stockout}d` : "—"}
              </td>
              <td className={`py-2 pr-4 font-semibold ${u.cls}`}>{u.label}</td>
              <td className="py-2 text-[var(--text-muted)]">
                {item.confidence != null ? `${(item.confidence * 100).toFixed(0)}%` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
