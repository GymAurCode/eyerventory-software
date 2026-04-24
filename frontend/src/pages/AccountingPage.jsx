import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHeader, DataTable } from "../components/UI";

export default function AccountingPage() {
  const [accounts, setAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("accounts");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/accounting/accounts"),
      api.get("/accounting/journal-entries"),
    ])
      .then(([acc, je]) => {
        setAccounts(acc.data);
        setJournalEntries(je.data);
      })
      .catch((err) => console.error("Failed to load accounting data:", err))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "PKR" }).format(value);

  const accountColumns = [
    { key: "name", label: "Account Name" },
    { key: "type", label: "Type", render: (r) => <span className="capitalize">{r.type}</span> },
    {
      key: "balance",
      label: "Balance",
      render: (r) => (
        <span
          className={
            r.type === "expense" || r.type === "asset"
              ? "font-semibold"
              : "font-semibold"
          }
        >
          {formatCurrency(r.balance)}
        </span>
      ),
    },
  ];

  const journalColumns = [
    {
      key: "date",
      label: "Date",
      render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-",
    },
    { key: "description", label: "Description" },
    { key: "reference_type", label: "Type", render: (r) => <span className="capitalize">{r.reference_type || "-"}</span> },
    {
      key: "items",
      label: "Items",
      render: (r) => (
        <div className="text-xs">
          {r.items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="min-w-max">{item.account_name}:</span>
              {item.debit > 0 && <span className="text-amber-400">DR {formatCurrency(item.debit)}</span>}
              {item.credit > 0 && <span className="text-blue-400">CR {formatCurrency(item.credit)}</span>}
            </div>
          ))}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Accounting" subtitle="Chart of Accounts and Journal Entries" />
        <div className="panel">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Accounting" subtitle="Chart of Accounts and Journal Entries" />

      {/* Tab Selector */}
      <div className="panel flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-semibold ${
            tab === "accounts"
              ? "border-b-2 border-indigo-400 text-indigo-400"
              : "text-slate-400"
          }`}
          onClick={() => setTab("accounts")}
        >
          Chart of Accounts
        </button>
        <button
          className={`px-4 py-2 font-semibold ${
            tab === "journal"
              ? "border-b-2 border-indigo-400 text-indigo-400"
              : "text-slate-400"
          }`}
          onClick={() => setTab("journal")}
        >
          Journal Entries ({journalEntries.length})
        </button>
      </div>

      {/* Accounts Tab */}
      {tab === "accounts" && (
        <div className="panel">
          <h3 className="mb-4 font-semibold">Chart of Accounts</h3>
          <DataTable columns={accountColumns} data={accounts} searchPlaceholder="Search accounts..." />
        </div>
      )}

      {/* Journal Entries Tab */}
      {tab === "journal" && (
        <div className="panel">
          <h3 className="mb-4 font-semibold">Journal Entries</h3>
          <DataTable columns={journalColumns} data={journalEntries} searchPlaceholder="Search journal entries..." />
        </div>
      )}
    </div>
  );
}
