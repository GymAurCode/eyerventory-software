import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { salesBreakdownApi } from "../api/salesBreakdown";
import { EmptyState, LoadingSkeleton, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const COLORS = ["#008080", "#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-[var(--bg-card)] p-3 text-xs shadow-xl" style={{ borderColor: "var(--border-color)" }}>
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }}>
          {entry.name}: {formatPKR(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function SalesBreakdownPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const loadMonth = async () => {
    setLoading(true);
    try {
      const [monthly, weekly, trend] = await Promise.all([
        salesBreakdownApi.monthly(year, month),
        viewMode === "weekly" ? salesBreakdownApi.weekly(year, month) : Promise.resolve([]),
        salesBreakdownApi.trend(12),
      ]);
      setBreakdown(monthly);
      if (viewMode === "weekly") setWeeklyData(weekly);
      setTrendData(trend);
    } catch (err) {
      toast.error("Failed to load sales breakdown");
    } finally {
      setLoading(false);
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    loadMonth();
  }, [year, month, viewMode]);

  const hasCredit = breakdown && breakdown.outstanding_credit > 0;
  const hasPartners = breakdown && breakdown.partner_count > 0;
  const hasDonation = breakdown && breakdown.donation_enabled && breakdown.donation_amount > 0;

  const pieData = useMemo(() => {
    if (!breakdown || !hasPartners) return [];
    return breakdown.partner_distribution.map((p, idx) => ({
      name: p.name,
      value: p.amount,
      percent: p.profit_share_percent,
    }));
  }, [breakdown, hasPartners]);

  const barData = useMemo(() => {
    if (trendData.length === 0) return [];
    return trendData.map((t) => ({
      name: t.label,
      Revenue: t.revenue,
      Expenses: t.expenses,
      Purchases: t.purchases,
      Profit: t.profit,
    }));
  }, [trendData]);

  const currentYear = now.getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Breakdown"
        subtitle="Monthly and weekly financial breakdown with partner profit distribution."
      />

      {/* Filters */}
      <div className="panel flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Month</label>
          <select className="input max-w-[140px]" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Year</label>
          <select className="input max-w-[100px]" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border-color)" }}>
          {["monthly", "weekly"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {mode === "monthly" ? "Monthly" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : !breakdown ? (
        <EmptyState title="No data" description="No sales recorded for this period." />
      ) : viewMode === "weekly" ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard title="Total Revenue" value={breakdown.revenue} tone="emerald" money icon="ti-currency-dollar" />
            <StatCard title="Expenses" value={breakdown.expenses} tone="rose" money icon="ti-currency-dollar" />
            <StatCard title="Purchases" value={breakdown.purchases} tone="amber" money icon="ti-shopping-cart" />
            <StatCard title="Final Profit" value={breakdown.final_profit} tone="indigo" money icon="ti-coin" />
          </div>
          <div className="panel overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th className="px-4 py-3 text-left">Week</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Expenses</th>
                  <th className="px-4 py-3 text-right">Purchases</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((w) => (
                  <tr key={w.week} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-4 py-3">
                      Week {w.week} <span className="text-xs" style={{ color: "var(--text-secondary)" }}>({w.week_start} — {w.week_end})</span>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">{formatPKR(w.revenue)}</td>
                    <td className="px-4 py-3 text-right text-rose-400">{formatPKR(w.expenses)}</td>
                    <td className="px-4 py-3 text-right text-amber-400">{formatPKR(w.purchases)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPKR(w.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Revenue" value={breakdown.revenue} tone="emerald" money icon="ti-currency-dollar" />
            <StatCard title="Expenses" value={breakdown.expenses} tone="rose" money icon="ti-currency-dollar" />
            <StatCard title="Purchases" value={breakdown.purchases} tone="amber" money icon="ti-shopping-cart" />
            <StatCard title="Final Net Profit" value={breakdown.final_profit} tone="indigo" money icon="ti-coin" />
          </div>

          {/* Outstanding Credit (conditional) */}
          {hasCredit && (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
              <StatCard title="Outstanding Credit" value={breakdown.outstanding_credit} tone="rose" money icon="ti-credit-card" />
            </div>
          )}

          {/* Donation Deduction (conditional) */}
          {hasDonation && (
            <div className="panel">
              <div className="flex items-center justify-between text-sm">
                <span>Donation Deducted ({breakdown.donation_percentage}%)</span>
                <span className="font-semibold text-rose-400">- {formatPKR(breakdown.donation_amount)}</span>
              </div>
            </div>
          )}

          {/* Partner Profit Split Section (only if partners were active in this month) */}
          {hasPartners && (
            <div className="panel">
              <h3 className="mb-3 text-sm font-semibold">Profit Distribution</h3>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Final Profit: <span className="font-semibold text-[var(--text-primary)]">{formatPKR(breakdown.final_profit)}</span>
              </div>
              {hasDonation && (
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  After donation: <span className="font-semibold text-[var(--text-primary)]">{formatPKR(breakdown.profit_after_donation)}</span>
                </div>
              )}
              <div className="mt-2 space-y-2">
                {breakdown.partner_distribution.map((p, idx) => (
                  <div
                    key={p.user_id}
                    className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm"
                    style={{ background: "var(--bg-elevated)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {p.profit_share_percent}%
                        {p.has_investment && p.investment_amount != null && (
                          <span className="ml-2">(Investment: {formatPKR(p.investment_amount)})</span>
                        )}
                      </span>
                    </div>
                    <span className="font-semibold">{formatPKR(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Trend Bar Chart */}
            <div className="panel">
              <h3 className="mb-3 text-sm font-semibold">12-Month Trend</h3>
              {trendLoading ? (
                <LoadingSkeleton rows={3} />
              ) : barData.length === 0 ? (
                <EmptyState title="No trend data" description="" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="Revenue" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Purchases" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Profit" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Partner Split Donut Chart (only if partners active) */}
            <div className="panel">
              <h3 className="mb-3 text-sm font-semibold">
                {hasPartners ? "Partner Profit Split" : "Revenue vs Expenses vs Profit"}
              </h3>
              {hasPartners && pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [formatPKR(value), name]}
                        contentStyle={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 text-xs">
                    {pieData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                        <span style={{ color: "var(--text-secondary)" }}>{entry.name} ({entry.percent}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {breakdown && (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={[
                        { name: "Revenue", value: breakdown.revenue },
                        { name: "Expenses", value: breakdown.expenses },
                        { name: "Purchases", value: breakdown.purchases },
                        { name: "Profit", value: breakdown.final_profit },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                        <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#008080" radius={[2, 2, 0, 0]}>
                          {[
                            { color: "#22c55e" },
                            { color: "#ef4444" },
                            { color: "#f59e0b" },
                            { color: "#6366f1" },
                          ].map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
