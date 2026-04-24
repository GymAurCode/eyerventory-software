import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";

const DEFAULT_SUMMARY = {
  total_revenue: 0, total_cost: 0, total_expenses: 0,
  operational_expenses: 0, salary_expenses: 0,
  raw_profit: 0, donation_amount: 0, total_profit: 0,
};

const DEFAULT_PNL = {
  revenue: 0, expenses: 0, profit: 0,
  revenue_breakdown: {}, expense_breakdown: {},
};

export default function FinancePage() {
  const [s, setS] = useState(DEFAULT_SUMMARY);
  const [pnl, setPnl] = useState(DEFAULT_PNL);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/finance/summary"), api.get("/finance/pnl")])
      .then(([sum, p]) => { setS(sum.data); setPnl(p.data); })
      .catch((err) => console.error("Failed to load finance data:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-5">
      <PageHeader title="Finance Report" subtitle="Revenue, expenses, and profitability" />
      <div className="panel">Loading...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Report" subtitle="Revenue, expenses, and profitability" />

      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue" value={s.total_revenue} tone="indigo" money />
        <StatCard title="Cost of Goods" value={s.total_cost} tone="amber" money />
        <StatCard title="Total Expenses" value={s.total_expenses} tone="rose" money />
        <StatCard title="Net Profit" value={s.total_profit} tone="emerald" money />
      </div>

      {/* Expense breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel space-y-3">
          <p className="font-semibold">Expense Breakdown</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Operational Expenses</span>
              <span className="font-semibold text-rose-400">{formatPKR(s.operational_expenses || 0)}</span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Salaries (HR Payments)</span>
              <span className="font-semibold text-rose-400">{formatPKR(s.salary_expenses || 0)}</span>
            </div>
            <div className="flex justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
              <span className="font-semibold">Total</span>
              <span className="font-semibold text-rose-400">{formatPKR(s.total_expenses || 0)}</span>
            </div>
          </div>
        </div>

        {/* P&L summary */}
        <div className="panel space-y-3">
          <p className="font-semibold">Profit & Loss</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Revenue</span>
              <span className="font-semibold text-emerald-400">{formatPKR(pnl.revenue)}</span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
              <span style={{ color: "var(--text-secondary)" }}>Total Expenses</span>
              <span className="font-semibold text-rose-400">{formatPKR(pnl.expenses)}</span>
            </div>
            {s.donation_amount > 0 && (
              <div className="flex justify-between rounded-lg px-3 py-2" style={{ background: "var(--bg-elevated)" }}>
                <span style={{ color: "var(--text-secondary)" }}>Donation Deduction</span>
                <span className="font-semibold text-rose-400">{formatPKR(s.donation_amount)}</span>
              </div>
            )}
            <div className="flex justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--border-color)" }}>
              <span className="font-semibold">Net Profit</span>
              <span className={`font-semibold ${pnl.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatPKR(pnl.profit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Full P&L breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(pnl.expense_breakdown).length > 0 && (
          <div className="panel">
            <p className="mb-3 font-semibold">Expense Detail</p>
            <div className="space-y-2">
              {Object.entries(pnl.expense_breakdown).map(([account, amount]) => (
                <div key={account} className="flex justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-elevated)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{account}</span>
                  <span className="font-semibold text-rose-400">{formatPKR(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(pnl.revenue_breakdown).length > 0 && (
          <div className="panel">
            <p className="mb-3 font-semibold">Revenue Detail</p>
            <div className="space-y-2">
              {Object.entries(pnl.revenue_breakdown).map(([account, amount]) => (
                <div key={account} className="flex justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-elevated)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{account}</span>
                  <span className="font-semibold text-emerald-400">{formatPKR(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
