import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/client";
import { posApi } from "../api/pos";
import { DataTable, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { formatPKR } from "../utils/currency";
import ChartOfAccountsPage from "./ChartOfAccountsPage";
import PaymentsPage from "./PaymentsPage";
import PurchasesPage from "./PurchasesPage";

const TABS = ["summary", "pnl", "balance-sheet"];

const TAB_LABELS = { summary: "Summary", pnl: "Profit & Loss", "balance-sheet": "Balance Sheet" };

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];
const TYPE_COLORS = {
  asset:     "text-indigo-400",
  liability: "text-rose-400",
  equity:    "text-emerald-400",
  revenue:   "text-emerald-400",
  expense:   "text-amber-400",
};
const TYPE_BADGE = {
  asset:     "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  liability: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  equity:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  revenue:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expense:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function BreakdownList({ items = {}, tone = "indigo" }) {
  const color = tone === "emerald" ? "text-emerald-400" : tone === "rose" ? "text-rose-400" : "text-indigo-400";
  const entries = Object.entries(items);
  if (!entries.length) return <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No data</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([label, amount]) => (
        <div key={label} className="flex justify-between rounded-lg px-3 py-2 text-sm" style={{ background: "var(--bg-elevated)" }}>
          <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          <span className={`font-semibold ${color}`}>{formatPKR(amount)}</span>
        </div>
      ))}
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex justify-between border-t pt-2 text-sm font-semibold" style={{ borderColor: "var(--border-color)" }}>
      <span>{label}</span>
      <span>{formatPKR(value)}</span>
    </div>
  );
}

function Section({ title, items = {}, tone, total }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{title}</p>
      <BreakdownList items={items} tone={tone} />
      <TotalRow label={`Total ${title}`} value={total} />
    </div>
  );
}

export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("summary");
  const [summary, setSummary] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [bs, setBs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [accounts, setAccounts] = useState([]);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["overview", "coa", "purchases", "payments", "ledger", "invoices"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "ledger" && accounts.length === 0) {
      api.get("/accounting/accounts")
        .then((r) => setAccounts(r.data))
        .catch(() => {});
    }
  }, [activeTab, accounts.length]);

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
      <PageHeader title="Finance" subtitle="Overview, accounts, credit, and payments" />
      <div className="panel">Loading...</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Overview, accounts, credit, and payments" />
      <div className="flex gap-1 rounded-lg border p-1 flex-wrap" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "coa", label: "Chart of Accounts" },
          { id: "purchases", label: "Purchases" },
          { id: "payments", label: "Payments" },
          { id: "ledger", label: "Account Ledger" },
          { id: "invoices", label: "Invoices" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchParams(tab.id === "overview" ? {} : { tab: tab.id }); }}
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
      {activeTab === "purchases" && <PurchasesPage embedded />}
      {activeTab === "payments" && <PaymentsPage embedded />}
      {activeTab === "ledger" && (
        <LedgerView
          accounts={accounts}
          setAccounts={setAccounts}
          ledgerAccount={ledgerAccount}
          setLedgerAccount={setLedgerAccount}
          ledgerData={ledgerData}
          setLedgerData={setLedgerData}
          ledgerLoading={ledgerLoading}
            setLedgerLoading={setLedgerLoading}
        />
      )}
      {activeTab === "invoices" && <InvoicesView />}
      {activeTab !== "overview" ? null : (
        <>

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
      )}

      {/* Full P&L breakdown */}
      {tab === "pnl" && pnl && (
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
      )}
        </>
      )}
    </div>
  );
}

function InvoicesView() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    posApi.listSales()
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const invoiceColumns = [
    { key: "bill_number", label: "Invoice#" },
    {
      key: "created_at", label: "Date",
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "customer", label: "Customer",
      render: (row) => row.customer?.name || "Walk-in",
    },
    {
      key: "items", label: "Items",
      render: (row) => row.items?.length || 0,
    },
    {
      key: "total", label: "Amount",
      render: (row) => formatPKR(row.total),
    },
    {
      key: "payment_method", label: "Payment",
      render: (row) => <span className="capitalize">{row.payment_method}</span>,
    },
    {
      key: "status", label: "Status",
      render: (row) => {
        if (row.status === "completed") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400">Paid</span>;
        if (row.status === "returned") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-400">Returned</span>;
        if (row.status === "partial_return") return <span className="rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-400">Partial Return</span>;
        return <span>{row.status}</span>;
      },
    },
    {
      key: "actions", label: "Actions", align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button className="icon-btn icon-btn-view" onClick={() => { setSelected(row); setViewOpen(true); }} title="View Invoice">
            <i className="ti ti-eye" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-print" onClick={() => printInvoice(row)} title="Print Invoice">
            <i className="ti ti-printer" style={{ fontSize: "16px" }} />
          </button>
        </div>
      ),
    },
  ];

  const printInvoice = (inv) => {
    const w = window.open("", "Invoice", "width=500,height=700");
    if (!w) return;
    const itemRows = (inv.items || []).map((i) =>
      `<tr><td>${i.item_name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${formatPKR(i.unit_price)}</td><td style="text-align:right">${formatPKR(i.total_price)}</td></tr>`
    ).join("");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Invoice</title>
      <style>
        @media print { body * { visibility: hidden; } #invoice, #invoice * { visibility: visible; } #invoice { position: absolute; top: 0; left: 0; width: 10cm; padding: 10px; } }
        body { font-family: 'Courier New', monospace; margin: 0; padding: 10px; font-size: 12px; }
        #invoice { width: 10cm; margin: 0 auto; }
        h1, h3 { text-align: center; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 4px 6px; border-bottom: 1px solid #ccc; text-align: left; }
        th { background: #f0f0f0; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .line { border-top: 2px solid #000; margin-top: 4px; }
      </style></head><body>
      <div id="invoice">
        <h1>INVOICE</h1>
        <h3>EYERFLOW OPTICAL</h3>
        <hr/>
        <table style="border: none;">
          <tr><td><strong>Invoice#:</strong> ${inv.bill_number}</td><td style="text-align:right"><strong>Date:</strong> ${new Date(inv.created_at).toLocaleDateString()}</td></tr>
          <tr><td><strong>Customer:</strong> ${inv.customer?.name || "Walk-in"}</td><td style="text-align:right"><strong>Payment:</strong> ${inv.payment_method}</td></tr>
        </table>
        <hr/>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="line"></div>
        <div style="text-align:right">
          <p><strong>Subtotal:</strong> ${formatPKR(inv.subtotal)}</p>
          ${inv.discount > 0 ? `<p><strong>Discount:</strong> -${formatPKR(inv.discount)}</p>` : ""}
          <p style="font-size:14px;"><strong>TOTAL:</strong> ${formatPKR(inv.total)}</p>
        </div>
        <hr/>
        <p style="text-align:center;font-size:10px;">Thank you for your business!</p>
      </div>
      <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
    w.document.close();
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Invoices" value={invoices.length} tone="indigo" icon="ti-file-invoice" />
        <StatCard title="Total Billed" value={invoices.reduce((s, r) => s + r.total, 0)} tone="emerald" money icon="ti-currency-dollar" />
        <StatCard title="Outstanding" value={invoices.filter((r) => r.status === "pending").reduce((s, r) => s + r.total, 0)} tone="amber" money icon="ti-clock" />
      </div>

      {invoices.length === 0 ? (
        <div className="panel text-center py-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          No invoices yet. Create a sale from POS / Billing.
        </div>
      ) : (
        <DataTable
          columns={invoiceColumns}
          data={invoices}
          searchPlaceholder="Search by invoice number..."
          searchableColumns={["bill_number"]}
        />
      )}

      <Modal title={`Invoice — ${selected?.bill_number || ""}`} open={viewOpen} onClose={() => { setViewOpen(false); setSelected(null); }} maxWidth="max-w-2xl">
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span><strong>Invoice#:</strong> {selected.bill_number}</span>
              <span style={{ color: "var(--text-secondary)" }}>{new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <p><strong>Customer:</strong> {selected.customer?.name || "Walk-in"}</p>
            <p><strong>Payment:</strong> {selected.payment_method}</p>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-elevated)" }}>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.items || []).map((item) => (
                    <tr key={item.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-3 py-1.5">{item.item_name}</td>
                      <td className="px-3 py-1.5 text-center">{item.qty}</td>
                      <td className="px-3 py-1.5 text-right">{formatPKR(item.unit_price)}</td>
                      <td className="px-3 py-1.5 text-right">{formatPKR(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 text-right">
              <p>Subtotal: {formatPKR(selected.subtotal)}</p>
              {selected.discount > 0 && <p>Discount: -{formatPKR(selected.discount)}</p>}
              <p className="font-bold text-base">Total: {formatPKR(selected.total)}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LedgerView({ accounts, setAccounts, ledgerAccount, setLedgerAccount, ledgerData, setLedgerData, ledgerLoading, setLedgerLoading }) {
  useEffect(() => {
    if (accounts.length === 0) {
      api.get("/accounting/accounts")
        .then((r) => setAccounts(r.data))
        .catch(() => {});
    }
  }, [accounts.length, setAccounts]);

  const loadLedger = async (account) => {
    setLedgerAccount(account);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const res = await api.get(`/accounting/account/${account.id}/ledger`);
      setLedgerData(res.data);
    } catch (err) {
      console.error("Ledger load error:", err);
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="panel">
        <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Select account</p>
        <div className="flex flex-wrap gap-2">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              className={`btn-soft text-sm ${ledgerAccount?.id === acc.id ? "ring-2 ring-indigo-500" : ""}`}
              onClick={() => loadLedger(acc)}
            >
              {acc.code && <span className="mr-1 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{acc.code}</span>}
              {acc.name}
            </button>
          ))}
        </div>
      </div>

      {ledgerLoading && <LoadingSkeleton rows={5} />}

      {ledgerData && !ledgerLoading && (
        <div className="panel p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
            <div>
              <span className="font-semibold">{ledgerData.account.name}</span>
              <span className={`ml-2 rounded border px-1.5 py-0.5 text-xs capitalize ${TYPE_BADGE[ledgerData.account.type] ?? ""}`}>{ledgerData.account.type}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{ledgerData.account.code}</span>
          </div>
          {ledgerData.entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-secondary)" }}>No transactions for this account yet.</p>
          ) : (
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Ref</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.entries.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2">{row.description}</td>
                    <td className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {row.reference_type}{row.reference_id ? ` #${row.reference_id}` : ""}
                    </td>
                    <td className="px-4 py-2 text-right text-amber-400">{row.debit > 0 ? formatPKR(row.debit) : "—"}</td>
                    <td className="px-4 py-2 text-right text-blue-400">{row.credit > 0 ? formatPKR(row.credit) : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatPKR(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
