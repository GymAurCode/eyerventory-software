import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { StatCard } from "../components/UI";
import api from "../api/client";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isToday(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr).toISOString().slice(0, 10) === todayStr();
}

const ACTION_COLORS = {
  sale: { dot: "🟢", icon: "ti-receipt" },
  purchase: { dot: "🔵", icon: "ti-shopping-cart" },
  item_added: { dot: "🔵", icon: "ti-box" },
  item_updated: { dot: "⚪", icon: "ti-edit" },
  item_deleted: { dot: "🔴", icon: "ti-trash" },
  return: { dot: "🟠", icon: "ti-receipt-refund" },
  low_stock: { dot: "🟠", icon: "ti-alert-triangle" },
  customer_added: { dot: "🔵", icon: "ti-user-plus" },
};

function RecentActivities() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef(null);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await api.get("/activities?limit=20");
      setActivities(res.data);
      setError(false);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivities();
    intervalRef.current = setInterval(fetchActivities, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchActivities]);

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isDark ? "#0d2020" : "#ffffff",
        border: "0.5px solid",
        borderColor: isDark ? "rgba(0,128,128,0.22)" : "#c0d8d8",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ti ti-clock" style={{ color: "#008080", fontSize: "14px" }} />
          <span className="text-xs font-medium" style={{ color: isDark ? "#c0efef" : "#002a2a" }}>Recent Activities</span>
        </div>
        <button
          className="text-xs hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
          onClick={fetchActivities}
          title="Refresh"
        >
          <i className="ti ti-refresh" style={{ fontSize: "12px" }} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: isDark ? "rgba(0,128,128,0.08)" : "rgba(0,0,0,0.04)" }} />
          ))}
        </div>
      ) : error ? (
        <div className="py-4 text-center">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Could not load activities</p>
          <button className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300" onClick={fetchActivities}>
            <i className="ti ti-refresh mr-1" />Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <p className="py-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>No recent activity</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {activities.map((act) => {
            const meta = ACTION_COLORS[act.action_type] || { dot: "⚪", icon: "ti-info-circle" };
            return (
              <div
                key={act.id}
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="shrink-0 mt-0.5">{meta.dot}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ color: "var(--text-primary)" }}>{act.description}</p>
                  <p style={{ color: "var(--text-secondary)" }}>{act.time_ago}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Add Product",   icon: "ti-box",              color: "#008080", route: "/products" },
  { label: "POS / Billing", icon: "ti-receipt",          color: "#F5C518", route: "/pos" },
  { label: "Add Supplier",  icon: "ti-truck",            color: "#008080", route: "/credit" },
  { label: "Sales",         icon: "ti-clipboard-list",   color: "#F5C518", route: "/sales" },
  { label: "Scan Barcode",  icon: "ti-scan",             color: "#008080", route: "/pos" },
  { label: "View Reports",  icon: "ti-chart-bar",        color: "#F5C518", route: "/analytics" },
];

function QuickActions() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isDark ? "#0d2020" : "#ffffff",
        border: "0.5px solid",
        borderColor: isDark ? "rgba(0,128,128,0.22)" : "#c0d8d8",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <i className="ti ti-bolt" style={{ color: "#F5C518", fontSize: "14px" }} />
        <span className="text-xs font-medium" style={{ color: isDark ? "#c0efef" : "#002a2a" }}>Quick Actions</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.route)}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-all duration-150"
            style={{
              color: isDark ? "#c0efef" : "#002a2a",
              border: "0.5px solid transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark ? "rgba(245,197,24,0.08)" : "rgba(0,128,128,0.06)";
              e.currentTarget.style.borderColor = isDark ? "rgba(245,197,24,0.15)" : "rgba(0,128,128,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ background: action.color + (isDark ? "22" : "11") }}
            >
              <i className={`ti ${action.icon}`} style={{ fontSize: "13px", color: action.color }} />
            </div>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [stats, setStats] = useState([
    { title: "Total Items",   value: 0, icon: "ti-box",              color: "#008080", trend: null, trendUp: true  },
    { title: "Stock Value",   value: 0, icon: "ti-currency-dollar", color: "#F5C518", trend: null, trendUp: true, money: true },
    { title: "Low Stock",     value: 0, icon: "ti-alert-triangle",   color: "#ef4444", trend: null, trendUp: false },
    { title: "Orders Today",  value: 0, icon: "ti-clipboard-check", color: "#008080", trend: null, trendUp: true  },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [prodRes, salesRes] = await Promise.all([
          api.get("/products"),
          api.get("/sales"),
        ]);

        if (cancelled) return;

        const products = Array.isArray(prodRes.data) ? prodRes.data : [];
        const sales = Array.isArray(salesRes.data) ? salesRes.data : [];

        const totalItems = products.length;
        const stockValue = products.reduce((sum, p) => sum + (Number(p.stock) * Number(p.cost_price || 0)), 0);
        const lowStock = products.filter((p) => Number(p.stock) < 10).length;
        const ordersToday = sales.filter((s) => isToday(s.created_at)).length;

        setStats([
          { title: "Total Items",   value: totalItems, icon: "ti-box",              color: "#008080", trend: null, trendUp: true  },
          { title: "Stock Value",   value: stockValue, icon: "ti-currency-dollar", color: "#F5C518", trend: null, trendUp: true, money: true },
          { title: "Low Stock",     value: lowStock,   icon: "ti-alert-triangle",   color: "#ef4444", trend: null, trendUp: false },
          { title: "Orders Today",  value: ordersToday, icon: "ti-clipboard-check", color: "#008080", trend: null, trendUp: true  },
        ]);
      } catch {
        // backend not ready
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-[18px] space-y-[14px]">
      <div>
        <h1 className="text-lg font-medium" style={{ color: isDark ? "#c0efef" : "#002a2a" }}>Dashboard</h1>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Inventory overview and key metrics</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="col-span-3">
          <RecentActivities />
        </div>
        <div className="col-span-2">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}