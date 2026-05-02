import { useEffect, useState } from "react";
import { getAccounts, getBalanceSheet, getJournalEntries, getProfitLoss } from "../api/accounting";
import { DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";

// ── shared tab bar ────────────────────────────────────────────────────────────
const TABS = ["Accounts", "Balance Sheet", "Profit & Loss", "Journal"];

function Tabs({ active, onChange }) {
  return (
    <div
      className="flex gap-1 rounded-lg border p-1"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}
    >
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
          style={
            active === t
              ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
              : { background: "transparent", color: "var(--text-secondary)" }
          }
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  asset:     { text: "#10B981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)" },
  liability: { text: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)" },
  equity:    { text: "#6366F1", bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.25)" },
  revenue:   { text: "#F59E0B", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)" },
  expense:   { text: "#F97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)" },
};
const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];

function SectionHeader({ type, count }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.asset;
  return (
    <div
      className="flex items-center justify-between border-b px-4 py-2.5"
      style={{ borderColor: c.border, background: c.bg }}
    >
      <span className="text-sm font-semibold capitalize" style={{ color: c.text }}>
        {type === "expense" ? "Expenses" : type === "equity" ? "Equity" : `${type}s`}
      </span>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{count} accounts</span>
    </div>
  );
}

// ── Accounts tab ──────────────────────────────────────────────────────────────
function AccountsTab({ accounts }) {
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = accounts.filter((a) => a.type === type);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {TYPE_ORDER.map((type) => (
        <div key={type} className="panel overflow-hidden p-0">
          <SectionHeader type={type} count={grouped[type]?.length ?? 0} />
          {grouped[type]?.length === 0 ? (
            <p className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>No accounts</p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Account Name</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {grouped[type].map((acc) => (
                  <tr key={acc.id}>
                    <td className="px-4 py-2">{acc.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatPKR(acc.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Balance Sheet tab ─────────────────────────────────────────────────────────
function BalanceSheetTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getBalanceSheet()
      .then(setData)
      .catch(() => setError("Failed to load balance sheet."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <p className="text-sm text-rose-400">{error}</p>;
  if (!data) return null;

  const isBalanced = Math.abs(data.assets - (data.liabilities + data.equity)) < 0.01;

  const Section = ({ title, breakdown, total, type }) => {
    const c = TYPE_COLORS[type];
    const entries = Object.entries(breakdown || {});
    return (
      <div className="panel overflow-hidden p-0">
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
          <span className="font-bold font-mono" style={{ color: c.text }}>{formatPKR(total)}</span>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>No entries</p>
        ) : (
          <table className="data-table w-full text-sm">
            <tbody>
              {entries.map(([name, balance]) => (
                <tr key={name}>
                  <td className="px-4 py-2">{name}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatPKR(balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Equation check banner */}
      <div
        className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium"
        style={{
          borderColor: "var(--border-color)",
          background: "var(--bg-card)",
        }}
      >
        <span style={{ color: "var(--text-primary)" }}>Assets = Liabilities + Equity</span>
        <span className="font-mono" style={{ color: isBalanced ? "#10B981" : "#EF4444" }}>
          {formatPKR(data.assets)} = {formatPKR(data.liabilities)} + {formatPKR(data.equity)}
          &nbsp;{isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
        </span>
      </div>

      {/* Summary stat row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Assets",      value: data.assets,      color: "#10B981" },
          { label: "Total Liabilities", value: data.liabilities, color: "#EF4444" },
          { label: "Total Equity",      value: data.equity,      color: "#6366F1" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border p-4 text-center"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
          >
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</p>
            <p className="mt-1 text-xl font-bold font-mono" style={{ color }}>{formatPKR(value)}</p>
          </div>
        ))}
      </div>

      {/* Detailed sections */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Assets" breakdown={data.assets_breakdown} total={data.assets} type="asset" />
        <div className="space-y-4">
          <Section title="Liabilities" breakdown={data.liabilities_breakdown} total={data.liabilities} type="liability" />
          <Section title="Equity" breakdown={data.equity_breakdown} total={data.equity} type="equity" />
        </div>
      </div>

      {/* Net position */}
      <div
        className="rounded-xl border px-4 py-3 text-right"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Net Position (Assets − Liabilities): </span>
        <span className="ml-2 font-bold font-mono" style={{ color: data.assets - data.liabilities >= 0 ? "#10B981" : "#EF4444" }}>
          {formatPKR(data.assets - data.liabilities)}
        </span>
      </div>
    </div>
  );
}

// ── Profit & Loss tab ─────────────────────────────────────────────────────────
function ProfitLossTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfitLoss().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton rows={5} />;
  if (!data) return null;

  const isProfit = data.profit >= 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Revenue",  value: data.revenue,  color: "#F59E0B" },
          { label: "Total Expenses", value: data.expenses, color: "#F97316" },
          { label: isProfit ? "Net Profit" : "Net Loss", value: Math.abs(data.profit), color: isProfit ? "#10B981" : "#EF4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border p-4 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</p>
            <p className="mt-1 text-xl font-bold font-mono" style={{ color }}>{formatPKR(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Revenue breakdown */}
        <div className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Revenue</span>
            <span className="font-bold font-mono" style={{ color: TYPE_COLORS.revenue.text }}>{formatPKR(data.revenue)}</span>
          </div>
          <table className="data-table w-full text-sm">
            <tbody>
              {Object.entries(data.revenue_breakdown || {}).map(([name, val]) => (
                <tr key={name}>
                  <td className="px-4 py-2">{name}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatPKR(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expense breakdown */}
        <div className="panel overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Expenses</span>
            <span className="font-bold font-mono" style={{ color: TYPE_COLORS.expense.text }}>{formatPKR(data.expenses)}</span>
          </div>
          <table className="data-table w-full text-sm">
            <tbody>
              {Object.entries(data.expense_breakdown || {}).map(([name, val]) => (
                <tr key={name}>
                  <td className="px-4 py-2">{name}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatPKR(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Net result */}
      <div
        className="rounded-xl border px-4 py-3 text-right"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      >
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {isProfit ? "Net Profit" : "Net Loss"} (Revenue − Expenses):
        </span>
        <span className="ml-2 font-bold font-mono text-lg" style={{ color: isProfit ? "#10B981" : "#EF4444" }}>
          {isProfit ? "+" : "-"}{formatPKR(Math.abs(data.profit))}
        </span>
      </div>
    </div>
  );
}

// ── Journal tab ───────────────────────────────────────────────────────────────
function JournalTab({ journal }) {
  const [selectedEntry, setSelectedEntry] = useState(null);

  const columns = [
    { key: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
    { key: "description", label: "Description" },
    { key: "reference_type", label: "Ref Type" },
    {
      key: "actions", label: "", render: (r) => (
        <button className="btn-soft px-3 py-1 text-xs" onClick={() => setSelectedEntry(r)}>View</button>
      ),
    },
  ];

  return (
    <>
      {journal.length === 0
        ? <EmptyState title="No journal entries" description="Transactions will appear here once recorded." />
        : <DataTable columns={columns} data={journal} rowKey="id" searchPlaceholder="Search journal..." />
      }

      <Modal title="Journal Entry" open={!!selectedEntry} onClose={() => setSelectedEntry(null)} maxWidth="max-w-xl">
        {selectedEntry && (
          <div>
            <p className="mb-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {new Date(selectedEntry.date).toLocaleString()} — {selectedEntry.reference_type} #{selectedEntry.reference_id}
            </p>
            <p className="mb-4 font-medium">{selectedEntry.description}</p>
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {selectedEntry.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{item.account_name}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.debit > 0 ? formatPKR(item.debit) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.credit > 0 ? formatPKR(item.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPKR(selectedEntry.items.reduce((s, i) => s + i.debit, 0))}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatPKR(selectedEntry.items.reduce((s, i) => s + i.credit, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Accounts");

  useEffect(() => {
    Promise.all([getAccounts(), getJournalEntries()])
      .then(([accs, entries]) => { setAccounts(accs); setJournal(entries); })
      .finally(() => setLoading(false));
  }, []);

  const totalAssets      = accounts.filter(a => a.type === "asset").reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === "liability").reduce((s, a) => s + a.balance, 0);
  const totalRevenue     = accounts.filter(a => a.type === "revenue").reduce((s, a) => s + a.balance, 0);
  const totalExpenses    = accounts.filter(a => a.type === "expense").reduce((s, a) => s + a.balance, 0);

  if (loading) return <LoadingSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Chart of Accounts" subtitle="Double-entry ledger, balance sheet, and P&L" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Assets"      value={totalAssets}      tone="emerald" money />
        <StatCard title="Total Liabilities" value={totalLiabilities} tone="rose"    money />
        <StatCard title="Total Revenue"     value={totalRevenue}     tone="amber"   money />
        <StatCard title="Total Expenses"    value={totalExpenses}    tone="indigo"  money />
      </div>

      <Tabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Accounts"      && <AccountsTab accounts={accounts} />}
      {activeTab === "Balance Sheet" && <BalanceSheetTab />}
      {activeTab === "Profit & Loss" && <ProfitLossTab />}
      {activeTab === "Journal"       && <JournalTab journal={journal} />}
    </div>
  );
}
