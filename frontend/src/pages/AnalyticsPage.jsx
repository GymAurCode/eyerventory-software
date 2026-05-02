import { memo, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Area, AreaChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import api from "../api/client";
import BulkImportPanel from "../components/BulkImportPanel";
import { PageHeader } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { useChartTheme } from "../hooks/useChartTheme";
import { formatPKR } from "../utils/currency";
import { generatePDF } from "../utils/reportPdf";

// ── Shared tab bar (same style as Settings) ───────────────────────────────────
function Tabs({ active, onChange }) {
  return (
    <div
      className="flex gap-1 rounded-lg border p-1"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", width: "fit-content" }}
    >
      {["Analytics", "Reports", "Bulk Import"].map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150"
          style={
            active === tab
              ? { background: "var(--bg-card)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
              : { background: "transparent", color: "var(--text-secondary)" }
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────
const CHART_COLORS = ["#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4", "#A855F7", "#14B8A6"];

const ChartCard = memo(function ChartCard({ title, children }) {
  return (
    <section className="panel h-[340px]">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="h-[280px]">{children}</div>
    </section>
  );
});

function monthKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function AnalyticsTab() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const chartTheme = useChartTheme();

  useEffect(() => {
    Promise.all([api.get("/products"), api.get("/sales"), api.get("/expenses")]).then(
      ([productRes, salesRes, expensesRes]) => {
        setProducts(productRes.data || []);
        setSales(salesRes.data || []);
        setExpenses(expensesRes.data || []);
      }
    );
  }, []);

  const incomeVsExpensesData = useMemo(() => {
    const map = new Map();
    sales.forEach((row) => {
      const key = monthKey(row.created_at);
      const prev = map.get(key) || { month: key, income: 0, expenses: 0 };
      prev.income += Number(row.revenue || 0);
      map.set(key, prev);
    });
    expenses.forEach((row) => {
      const key = monthKey(row.expense_date);
      const prev = map.get(key) || { month: key, income: 0, expenses: 0 };
      prev.expenses += Number(row.amount || 0);
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [sales, expenses]);

  const productDistributionData = useMemo(() => {
    const byCategory = new Map();
    products.forEach((item) => {
      const key = item.category || item.type || "Uncategorized";
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    });
    return [...byCategory.entries()].map(([name, value]) => ({ name, value }));
  }, [products]);

  const stockLevelsData = useMemo(
    () => products.map((item) => ({ name: item.name, stock: Number(item.stock || 0) })).sort((a, b) => b.stock - a.stock).slice(0, 12),
    [products]
  );

  const salesTrendData = useMemo(() => {
    const byDay = new Map();
    sales.forEach((row) => {
      const day = String(row.created_at || "").slice(0, 10) || "Unknown";
      const prev = byDay.get(day) || { day, quantity: 0 };
      prev.quantity += Number(row.quantity || 0);
      byDay.set(day, prev);
    });
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
  }, [sales]);

  const expensesBreakdownData = useMemo(() => {
    const byCategory = new Map();
    expenses.forEach((row) => {
      const key = row.category || "Other";
      byCategory.set(key, (byCategory.get(key) || 0) + Number(row.amount || 0));
    });
    return [...byCategory.entries()].map(([name, value]) => ({ name, value }));
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Income vs Expenses (Monthly)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={incomeVsExpensesData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle} labelStyle={chartTheme.tooltipLabelStyle} formatter={(v) => formatPKR(v)} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#22C55E" strokeWidth={2.2} dot={false} />
              <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sales Trends">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesTrendData}>
              <defs>
                <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle} labelStyle={chartTheme.tooltipLabelStyle} />
              <Area type="monotone" dataKey="quantity" stroke="#6366F1" fill="url(#salesAreaGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Product Categories Distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={productDistributionData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={98} paddingAngle={2}>
                {productDistributionData.map((entry, idx) => <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle} labelStyle={chartTheme.tooltipLabelStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock Levels">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stockLevelsData}>
              <defs>
                <linearGradient id="stockAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle} labelStyle={chartTheme.tooltipLabelStyle} />
              <Area type="monotone" dataKey="stock" stroke="#06B6D4" fill="url(#stockAreaGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses Breakdown">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expensesBreakdownData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={96} paddingAngle={2}>
                {expensesBreakdownData.map((entry, idx) => <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={chartTheme.tooltipStyle} itemStyle={chartTheme.tooltipItemStyle} labelStyle={chartTheme.tooltipLabelStyle} formatter={(v) => formatPKR(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "products",       label: "Products Report" },
  { id: "sales",          label: "Sales Report" },
  { id: "expenses",       label: "Expenses Report" },
  { id: "finance",        label: "Finance Report" },
  { id: "partner_profit", label: "Partner Profit Report" },
];

async function downloadReport(reportType, fmt, companyName) {
  try {
    if (fmt === "pdf") {
      const { data } = await api.get(`/reports/data?report_type=${reportType}`);
      await generatePDF({ title: data?.title || "Report", columns: data?.columns || [], data: data?.data || [], companyName });
      toast.success("PDF generated successfully");
      return;
    }
    const res = await api.get(`/reports/export?report_type=${reportType}&fmt=${fmt}`, { responseType: "blob" });
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}.${fmt === "excel" ? "xlsx" : "pdf"}`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err.response?.data?.detail || "Failed to export report");
  }
}

function ReportsTab() {
  const { companyName } = useBranding();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {REPORT_TYPES.map((item) => (
        <div key={item.id} className="panel flex items-center justify-between">
          <p className="font-medium">{item.label}</p>
          <div className="space-x-2">
            <button className="btn-soft" onClick={() => downloadReport(item.id, "pdf", companyName)}>PDF</button>
            <button className="btn-soft" onClick={() => downloadReport(item.id, "excel", companyName)}>Excel</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { state } = useLocation();
  const [activeTab, setActiveTab] = useState(state?.tab || "Analytics");

  return (
    <div className="space-y-4">
      <PageHeader title="Analytics & Reports" subtitle="Insights, charts, exportable reports, and bulk product import." />
      <Tabs active={activeTab} onChange={setActiveTab} />
      {activeTab === "Analytics"    && <AnalyticsTab />}
      {activeTab === "Reports"      && <ReportsTab />}
      {activeTab === "Bulk Import"  && <BulkImportPanel />}
    </div>
  );
}
