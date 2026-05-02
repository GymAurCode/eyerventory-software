import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import api from "../api/client";
import { DataTable, LoadingSkeleton, Modal, PageHeader } from "../components/UI";
import { formatPKR } from "../utils/currency";

const TABS = ["coa", "journal", "trial-balance", "ledger"];
const TAB_LABELS = { coa: "Chart of Accounts", journal: "Journal Entries", "trial-balance": "Trial Balance", ledger: "Account Ledger" };

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

export default function AccountingPage() {
  const [tab, setTab] = useState("coa");
  const [accounts, setAccounts] = useState([]);
  const [journal, setJournal] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ledgerAccount, setLedgerAccount] = useState(null);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [accRes, jeRes, tbRes] = await Promise.all([
        api.get("/accounting/accounts"),
        api.get("/accounting/journal-entries"),
        api.get("/accounting/trial-balance"),
      ]);
      setAccounts(accRes.data);
      setJournal(jeRes.data);
      setTrialBalance(tbRes.data);
    } catch (err) {
      console.error("Accounting load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  // Group accounts by type for COA tree view
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    acc[type] = accounts.filter((a) => a.type === type);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PageHeader title="Accounting" subtitle="Double-entry bookkeeping — Chart of Accounts, Journal Entries & Reports" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} className={`btn-soft ${tab === t ? "ring-2 ring-indigo-500" : ""}`} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton rows={8} /> : (
        <>
          {/* Chart of Accounts */}
          {tab === "coa" && (
            <div className="space-y-4">
              {TYPE_ORDER.map((type) => {
                const rows = grouped[type] ?? [];
                if (!rows.length) return null;
                const total = rows.reduce((s, a) => s + a.balance, 0);
                return (
                  <div key={type} className="panel p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
                      <span className={`font-semibold capitalize ${TYPE_COLORS[type]}`}>{type}s</span>
                      <span className={`text-sm font-semibold ${TYPE_COLORS[type]}`}>{formatPKR(total)}</span>
                    </div>
                    <table className="data-table w-full text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left">Code</th>
                          <th className="px-4 py-2 text-left">Account Name</th>
                          <th className="px-4 py-2 text-right">Balance</th>
                          <th className="px-4 py-2 text-right">Ledger</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((acc) => (
                          <tr key={acc.id}>
                            <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{acc.code || "—"}</td>
                            <td className="px-4 py-2">
                              <span className={`mr-2 rounded border px-1.5 py-0.5 text-xs ${TYPE_BADGE[acc.type]}`}>{acc.type}</span>
                              {acc.name}
                            </td>
                            <td className={`px-4 py-2 text-right font-semibold ${TYPE_COLORS[acc.type]}`}>{formatPKR(acc.balance)}</td>
                            <td className="px-4 py-2 text-right">
                              <button className="btn-soft px-2 py-1 text-xs" onClick={() => { setTab("ledger"); loadLedger(acc); }}>
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* Journal Entries */}
          {tab === "journal" && (
            <div className="panel p-0 overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
                <span className="font-semibold">Journal Entries ({journal.length})</span>
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                {journal.length === 0 && (
                  <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-secondary)" }}>No journal entries yet. Create a sale to generate entries.</p>
                )}
                {journal.map((entry) => {
                  const isOpen = expandedEntry === entry.id;
                  const totalDr = entry.items.reduce((s, i) => s + i.debit, 0);
                  const totalCr = entry.items.reduce((s, i) => s + i.credit, 0);
                  return (
                    <div key={entry.id} className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-opacity-50 transition-colors"
                        style={{ background: isOpen ? "var(--bg-elevated)" : undefined }}
                        onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>#{entry.id}</span>
                          <span className="text-sm truncate">{entry.description}</span>
                          {entry.reference_type && (
                            <span className="rounded px-1.5 py-0.5 text-xs border" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                              {entry.reference_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs shrink-0 ml-4">
                          <span style={{ color: "var(--text-secondary)" }}>{entry.date ? new Date(entry.date).toLocaleDateString() : "—"}</span>
                          <span className="text-amber-400">DR {formatPKR(totalDr)}</span>
                          <span className="text-blue-400">CR {formatPKR(totalCr)}</span>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-8 py-3 space-y-1.5" style={{ background: "var(--bg-elevated)" }}>
                          {entry.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`w-6 text-xs font-mono ${item.debit > 0 ? "text-amber-400" : "text-blue-400"}`}>
                                  {item.debit > 0 ? "DR" : "CR"}
                                </span>
                                <span>{item.account_name}</span>
                                {item.account_type && (
                                  <span className={`rounded border px-1 py-0.5 text-xs ${TYPE_BADGE[item.account_type] ?? ""}`}>{item.account_type}</span>
                                )}
                              </div>
                              <span className={`font-semibold ${item.debit > 0 ? "text-amber-400" : "text-blue-400"}`}>
                                {formatPKR(item.debit > 0 ? item.debit : item.credit)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Trial Balance */}
          {tab === "trial-balance" && trialBalance && (
            <div className="panel p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)" }}>
                <span className="font-semibold">Trial Balance</span>
                <span className={`text-sm font-semibold ${trialBalance.balanced ? "text-emerald-400" : "text-rose-400"}`}>
                  {trialBalance.balanced ? "✓ Balanced" : "⚠ Not Balanced"}
                </span>
              </div>
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">Code</th>
                    <th className="px-4 py-2 text-left">Account</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="px-4 py-2 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{acc.code || "—"}</td>
                      <td className="px-4 py-2">{acc.name}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded border px-1.5 py-0.5 text-xs capitalize ${TYPE_BADGE[acc.type] ?? ""}`}>{acc.type}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-amber-400">{acc.total_debit > 0 ? formatPKR(acc.total_debit) : "—"}</td>
                      <td className="px-4 py-2 text-right text-blue-400">{acc.total_credit > 0 ? formatPKR(acc.total_credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-4 py-3" colSpan={3}>Totals</td>
                    <td className="px-4 py-3 text-right text-amber-400">{formatPKR(trialBalance.total_debit)}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{formatPKR(trialBalance.total_credit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Account Ledger */}
          {tab === "ledger" && (
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
          )}
        </>
      )}
    </div>
  );
}
