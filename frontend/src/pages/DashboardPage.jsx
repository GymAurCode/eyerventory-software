import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { formatPKR } from "../utils/currency";

const QUICK_ACTIONS = [
  { label: "New Sale", path: "/sales", color: "#6366F1" },
  { label: "Add Product", path: "/products", color: "#22C55E" },
  { label: "Log Expense", path: "/expenses", color: "#F59E0B" },
  { label: "View Reports", path: "/reports", color: "#06B6D4" },
];

function QuickActions() {
  const navigate = useNavigate();
  return (
    <section className="panel">
      <p className="mb-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Quick Actions</p>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all hover:opacity-80 active:scale-95"
            style={{
              borderColor: action.color + "44",
              background: action.color + "18",
              color: action.color,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ActivityItem({ icon, label, sub, amount, tone }) {
  const colors = { sale: "#22C55E", expense: "#EF4444", product: "#6366F1" };
  const color = colors[tone] || "#6366F1";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: color + "22", color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{sub}</p>
      </div>
      {amount != null && (
        <span className="shrink-0 text-sm font-semibold" style={{ color }}>
          {amount}
        </span>
      )}
    </div>
  );
}

function RecentActivity({ sales, expenses }) {
  const items = [
    ...sales.slice(-8).map((s) => ({
      key: `sale-${s.id}`,
      icon: "S",
      tone: "sale",
      label: `Sale #${s.id}`,
      sub: s.created_at ? new Date(s.created_at).toLocaleDateString() : "—",
      amount: formatPKR(s.revenue ?? s.selling_price * s.quantity),
      ts: s.created_at,
    })),
    ...expenses.slice(-8).map((e) => ({
      key: `exp-${e.id}`,
      icon: "E",
      tone: "expense",
      label: e.description || e.category || `Expense #${e.id}`,
      sub: e.expense_date ? new Date(e.expense_date).toLocaleDateString() : "—",
      amount: formatPKR(e.amount),
      ts: e.expense_date,
    })),
  ]
    .sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))
    .slice(0, 8);

  return (
    <section className="panel">
      <p className="mb-2 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Recent Activity</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>No recent activity</p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
          {items.map((item) => (
            <ActivityItem key={item.key} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { role } = useAuth();
  const [summary, setSummary] = useState({ total_revenue: 0, total_profit: 0, total_expenses: 0 });
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const requests = [api.get("/finance/summary"), api.get("/products")];
    if (role === "owner") {
      requests.push(api.get("/sales"), api.get("/expenses"));
    }
    Promise.all(requests)
      .then(([fin, prod, salesRes, expRes]) => {
        setSummary(fin.data);
        setProducts(prod.data || []);
        if (salesRes) setSales(salesRes.data || []);
        if (expRes) setExpenses(expRes.data || []);
      })
      .catch(() => undefined);
  }, [role]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Operational metrics and financial overview" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {role === "owner" && <StatCard title="Revenue" value={summary.total_revenue} tone="indigo" money />}
        {role === "owner" && <StatCard title="Profit" value={summary.total_profit} tone="emerald" money />}
        {role === "owner" && <StatCard title="Expenses" value={summary.total_expenses} tone="rose" money />}
        <StatCard title="Products" value={products.length} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {role === "owner" && <RecentActivity sales={sales} expenses={expenses} />}
        </div>
        <QuickActions />
      </div>
    </div>
  );
}
