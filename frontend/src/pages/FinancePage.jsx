import { useEffect, useState } from "react";
import api from "../api/client";
import { PageHeader, StatCard } from "../components/UI";

export default function FinancePage() {
  const [s, setS] = useState({ total_revenue: 0, total_cost: 0, total_expenses: 0, raw_profit: 0, donation_amount: 0, total_profit: 0 });

  useEffect(() => {
    Promise.all([api.get("/finance/summary")]).then(([summary]) => {
      setS(summary.data);
    });
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader title="Finance Report" subtitle="Revenue, expenses, and profitability analysis" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Revenue" value={s.total_revenue} tone="indigo" money />
        <StatCard title="Cost" value={s.total_cost} tone="amber" money />
        <StatCard title="Expenses" value={s.total_expenses} tone="rose" money />
        <StatCard title="Raw Profit" value={s.raw_profit} tone="emerald" money />
        <StatCard title="Donation Deduction" value={s.donation_amount} tone="rose" money />
        <StatCard title="Final Profit" value={s.total_profit} tone="indigo" money />
      </div>
    </div>
  );
}
