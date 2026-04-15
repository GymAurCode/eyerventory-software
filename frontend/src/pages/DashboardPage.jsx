import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardPage() {
  const { role } = useAuth();
  const [summary, setSummary] = useState({ total_revenue: 0, total_profit: 0, total_expenses: 0 });
  const [products, setProducts] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/finance/summary"), api.get("/products")])
      .then(([fin, prod]) => {
        setSummary(fin.data);
        setProducts(prod.data);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Operational metrics and financial overview" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {role === "owner" && <StatCard title="Revenue" value={summary.total_revenue} tone="indigo" money />}
        {role === "owner" && <StatCard title="Profit" value={summary.total_profit} tone="emerald" money />}
        {role === "owner" && <StatCard title="Expenses" value={summary.total_expenses} tone="rose" money />}
        <StatCard title="Products" value={products.length} tone="amber" />
      </div>
    </div>
  );
}
