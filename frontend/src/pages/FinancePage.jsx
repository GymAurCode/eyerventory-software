import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";
import ChartOfAccountsPage from "./ChartOfAccountsPage";
import CreditManagementPage from "./CreditManagementPage";
import PaymentsPage from "./PaymentsPage";

const TABS = ["summary", "pnl", "balance-sheet"];

const TAB_LABELS = { summary: "Summary", pnl: "Profit & Loss", "balance-sheet": "Balance Sheet" };

export default function FinancePage() {
  const [tab, setTab] = useState("summary");
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [bs, setBs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/finance/summary"),
      api.get("/accounting/profit-loss"),
      api.get("/accounting/balance-sheet"),
    ])
      .then(([s, p, b]) => {
        setSummary(s.data);
        setPnl(p.data);
        setBs(b.data);
      })
      .catch((err) => console.error("Finance load error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-5">
<<<<<<< HEAD
      <PageHeader title="Finance" subtitle="Overview, accounts, credit, and payments" />
=======
      <PageHeader title="Finance" subtitle="Journal-based financial reports" />
>>>>>>> 46e9926520814fb4499ac2438f234e1b68d13f85
      <div className="panel">Loading...</div>
    </div>
  );

  return (
<<<<<<< HEAD
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Overview, accounts, credit, and payments" />
      <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "coa", label: "Chart of Accounts" },
          { id: "credit", label: "Credit Management" },
          { id: "payments", label: "Payments" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
            style={
              activeTab === tab.id
                ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                : { background: "transparent", color: "var(--text-secondary)" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "coa" && <ChartOfAccountsPage embedded />}
      {activeTab === "credit" && <CreditManagementPage embedded />}
      {activeTab === "payments" && <PaymentsPage embedded />}
      {activeTab !== "overview" ? null : (
        <>
=======
    <div className="space-y-5">
      <PageHeader title="Finance" subtitle="Journal-based financial reports" />
>>>>>>> 46e9926520814fb4499ac2438f234e1b68d13f85

      {/* Stat cards — always visible */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Revenue"   value={pnl?.revenue   ?? 0} tone="indigo"  money />
        <StatCard title="Total Expenses"  value={pnl?.expenses  ?? 0} tone="rose"    money />
        <StatCard title="Net Profit"      value={pnl?.profit    ?? 0} tone="emerald" money />
        <StatCard title="Total Assets"    value={bs?.assets     ?? 0} tone="amber"   money />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            className={`btn-soft ${tab === t ? "ring-2 ring-indigo-500" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {tab === "summary" && summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel space-y-3">
            <p className="font-semibold">Revenue</p>
            <BreakdownList items={pnl?.revenue_breakdown ?? {}} tone="emerald" />
          </div>
          <div className="panel space-y-3">
            <p className="font-semibold">Expenses</p>
            <BreakdownList items={pnl?.expense_breakdown ?? {}} tone="rose" />
          </div>
          {summary.donation_amount > 0 && (
            <div className="panel">
              <p className="font-semibold">Donation Deduction ({summary.donation_percentage}%)</p>
              <p className="mt-2 text-rose-400 font-semibold">{formatPKR(summary.donation_amount)}</p>
            </div>
          )}
        </div>
      )}

      {/* P&L tab */}
      {tab === "pnl" && pnl && (
        <div className="panel space-y-4">
          <p className="font-semibold text-base">Profit & Loss Statement</p>
          <Section title="Revenue" items={pnl.revenue_breakdown} tone="emerald" total={pnl.revenue} />
          <Section title="Expenses" items={pnl.expense_breakdown} tone="rose" total={pnl.expenses} />
          <div className="flex justify-between rounded-lg border px-4 py-3 font-semibold" style={{ borderColor: "var(--border-color)" }}>
            <span>Net Profit</span>
            <span className={pnl.profit >= 0 ? "text-emerald-400" : "text-rose-400"}>{formatPKR(pnl.profit)}</span>
          </div>
        </div>
      )}

      {/* Balance Sheet tab */}
      {tab === "balance-sheet" && bs && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel space-y-3">
            <p className="font-semibold">Assets</p>
            <BreakdownList items={bs.assets_breakdown} tone="indigo" />
            <TotalRow label="Total Assets" value={bs.assets} />
          </div>
          <div className="panel space-y-3">
            <p className="font-semibold">Liabilities & Equity</p>
            <BreakdownList items={bs.liabilities_breakdown} tone="rose" />
            <BreakdownList items={bs.equity_breakdown} tone="emerald" />
            <TotalRow label="Total L + E" value={bs.liabilities + bs.equity} />
          </div>
          <div className="panel md:col-span-2">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Accounting equation: Assets ({formatPKR(bs.assets)}) = Liabilities ({formatPKR(bs.liabilities)}) + Equity ({formatPKR(bs.equity)})
            </p>
            <p className={`mt-1 text-sm font-semibold ${Math.abs(bs.assets - (bs.liabilities + bs.equity)) < 1 ? "text-emerald-400" : "text-rose-400"}`}>
              {Math.abs(bs.assets - (bs.liabilities + bs.equity)) < 1 ? "✓ Balanced" : "⚠ Not balanced"}
            </p>
          </div>
        </div>
<<<<<<< HEAD
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
        </>
      )}
=======
      )}
    </div>
  );
}

function BreakdownList({ items, tone }) {
  const colors = { emerald: "text-emerald-400", rose: "text-rose-400", indigo: "text-indigo-400", amber: "text-amber-400" };
  return (
    <div className="space-y-1.5">
      {Object.entries(items).map(([name, amount]) => (
        <div key={name} className="flex justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-elevated)" }}>
          <span style={{ color: "var(--text-secondary)" }}>{name}</span>
          <span className={`font-semibold ${colors[tone] ?? ""}`}>{formatPKR(amount)}</span>
        </div>
      ))}
      {Object.keys(items).length === 0 && (
        <p className="text-sm px-3" style={{ color: "var(--text-secondary)" }}>No entries yet</p>
      )}
    </div>
  );
}

function Section({ title, items, tone, total }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{title}</p>
      <BreakdownList items={items} tone={tone} />
      <TotalRow label={`Total ${title}`} value={total} />
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex justify-between rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--border-color)" }}>
      <span>{label}</span>
      <span>{formatPKR(value)}</span>
>>>>>>> 46e9926520814fb4499ac2438f234e1b68d13f85
    </div>
  );
}
