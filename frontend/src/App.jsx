import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import api from "./api/client";
import AppSidebar from "./components/AppSidebar";
import CommandPalette from "./components/CommandPalette";
import HelpDocsModal from "./components/HelpDocsModal";
import NotificationCenter from "./components/NotificationCenter";
import { COMMAND_ITEMS, formatShortcut } from "./config/shortcuts";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BrandingProvider, useBranding } from "./contexts/BrandingContext";
import { ShortcutProvider } from "./contexts/ShortcutContext";
import { useTheme } from "./contexts/ThemeContext";
import { useShortcutManager } from "./hooks/useShortcutManager";
import { useReminderWebSocket } from "./hooks/useReminderWebSocket";

import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import FinancePage from "./pages/FinancePage";
import LoginPage from "./pages/LoginPage";
import PeoplePage from "./pages/PeoplePage";
import ProductsPage from "./pages/ProductsPage";
import PurchasesPage from "./pages/PurchasesPage";
import POSPage from "./pages/POSPage";
import SalesPage from "./pages/SalesPage";
import SettingsPage from "./pages/SettingsPage";
import CreditManagementPage from "./pages/CreditManagementPage";
import DevicesPage from "./pages/DevicesPage";
import HRManagementPage from "./pages/hr/HRManagementPage";
import WarehousePage from "./pages/WarehousePage";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const AIIntelligencePage = lazy(() => import("./pages/AIIntelligencePage"));
const LowStockDetailPage = lazy(() => import("./pages/ai/LowStockDetailPage"));
const AnomalyDetailPage = lazy(() => import("./pages/ai/AnomalyDetailPage"));
const PredictionsRiskPage = lazy(() => import("./pages/ai/PredictionsRiskPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));

function ProtectedRoute({ allow, children }) {
  const { role } = useAuth();
  if (!allow.includes(role)) return <Navigate to={role === "staff" ? "/products" : "/"} replace />;
  return children;
}

function Layout() {
  const { token, logout, role, name, validating } = useAuth();
  const { companyName } = useBranding();
  const { toggleTheme, theme } = useTheme();
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { notifications, dismiss, dismissAll, connected } = useReminderWebSocket(token);

  const isDark = theme === "dark";

  const [bellOpen, setBellOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const bellRef = useRef(null);

  const checkLowStock = useCallback(async () => {
    try {
      const res = await api.get("/activities/low-stock");
      const data = res.data;
      setLowStockItems(data.items || []);
      setLowStockCount(data.count || 0);
    } catch {
      try {
        const res = await api.get("/products");
        const items = Array.isArray(res.data) ? res.data : [];
        const low = items.filter((p) => Number(p.stock) < (p.low_stock_threshold || 10));
        setLowStockItems(low);
        setLowStockCount(low.length);
      } catch {
        // backend not ready yet
      }
    }
  }, []);

  useEffect(() => {
    checkLowStock();
    const interval = setInterval(checkLowStock, 60000);
    return () => clearInterval(interval);
  }, [checkLowStock]);

  const dispatchAction = (actionId) => {
    if (actionId === "app.commandPalette") return setShowPalette(true), true;
    if (actionId === "app.help") return setShowHelp(true), true;
    if (actionId === "app.themeToggle") return toggleTheme(), true;
    if (actionId === "nav.dashboard" && role === "owner") return navigate("/"), true;
    if (actionId === "nav.products") return navigate("/products"), true;
    if (actionId === "nav.sales") return navigate("/sales"), true;
    if (actionId === "nav.credit") return navigate("/credit"), true;
    if (actionId === "nav.expenses") return navigate("/expenses"), true;
    if (actionId === "nav.devices") return navigate("/devices"), true;
    if (actionId === "nav.finance" && role === "owner") return navigate("/finance"), true;
    if (actionId === "nav.ledger" && role === "owner") return navigate("/finance?tab=ledger"), true;
    if (actionId === "nav.analytics" && role === "owner") return navigate("/analytics"), true;
    if (actionId === "nav.ai" && role === "owner") return navigate("/ai-intelligence"), true;
    if (actionId === "nav.reminders") return navigate("/reminders"), true;
    if (actionId === "nav.users" && role === "owner") return navigate("/people"), true;
    if (actionId === "nav.hr" && (role === "owner" || role === "admin" || role === "hr")) return navigate("/hr"), true;
    return false;
  };

  const { registerPageAction, triggerAction, activeActionId } = useShortcutManager({ role, dispatchAction });

  const commandItems = useMemo(
    () =>
      COMMAND_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
        ...item,
        onSelect: () => {
          if (item.actionId === "products.add") {
            navigate("/products");
            window.setTimeout(() => triggerAction("products.add"), 50);
            return;
          }
          if (item.actionId === "sales.new") {
            navigate("/sales");
            window.setTimeout(() => triggerAction("sales.new"), 50);
            return;
          }
          triggerAction(item.actionId);
        },
      })),
    [navigate, role, triggerAction],
  );

  useEffect(() => {
    const key = "eyerflow_guide_seen";
    if (!localStorage.getItem(key)) {
      setShowGuide(true);
      localStorage.setItem(key, "1");
    }
  }, []);

  if (validating) return null;
  if (!token) return <LoginPage />;

  const shortcutApi = { registerPageAction, triggerAction, activeActionId, formatShortcut };

  return (
    <ShortcutProvider value={shortcutApi}>
      <div className="flex h-screen overflow-hidden p-2 gap-2">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col rounded-xl overflow-hidden" style={{ background: "var(--bg-app)" }}>
          <header className="flex h-14 items-center justify-between px-3" style={{ background: "var(--bg-card)", borderBottom: "0.5px solid var(--border-color)", borderRadius: "12px" }}>
            <div className="flex items-center gap-3">
              <h1 className="text-base font-medium" style={{ color: isDark ? "#c0efef" : "#002a2a" }}>{companyName || "EyerFlow"}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: "13px", color: "var(--text-secondary)" }} />
                <input
                  className="rounded-lg border bg-transparent py-1.5 pl-7 pr-3 text-xs outline-none transition-all w-44 focus:w-56"
                  placeholder="Search..."
                  style={{
                    borderColor: "var(--border-color)",
                    color: isDark ? "#c0efef" : "#002a2a",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#008080"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
                />
              </div>

              {/* ── Low Stock Bell ── */}
              <div className="relative" ref={bellRef}>
                <button
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                  style={{ border: "0.5px solid var(--border-color)" }}
                  onClick={() => setBellOpen((prev) => !prev)}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <i className="ti ti-bell" style={{ fontSize: "15px", color: "var(--text-secondary)" }} />
                  {lowStockCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {lowStockCount > 9 ? "9+" : lowStockCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                    <div
                      className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border shadow-2xl"
                      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                    >
                      <div className="border-b px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                        Low Stock Alerts
                      </div>
                      {lowStockItems.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                          All items are sufficient
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {lowStockItems.map((item) => (
                            <button
                              key={item.id}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                              onClick={() => { navigate("/products"); setBellOpen(false); }}
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold">
                                {item.stock}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Stock: {item.stock} — Click to view</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors"
                style={{ border: "0.5px solid var(--border-color)" }}
                onClick={toggleTheme}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <i className={`ti ${isDark ? "ti-sun" : "ti-moon"}`} style={{ fontSize: "14px", color: "var(--text-secondary)" }} />
              </button>
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3">
          <main className="flex-1">
            <Suspense fallback={<div className="flex items-center justify-center h-32 text-xs" style={{ color: "var(--text-secondary)" }}>Loading...</div>}>
              <Routes>
                <Route path="/" element={<ProtectedRoute allow={["owner"]}><DashboardPage /></ProtectedRoute>} />
                <Route path="/pos" element={<ProtectedRoute allow={["owner", "staff"]}><POSPage /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute allow={["owner", "staff"]}><ProductsPage /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute allow={["owner", "staff"]}><SalesPage /></ProtectedRoute>} />
                <Route path="/purchases" element={<ProtectedRoute allow={["owner", "staff"]}><PurchasesPage /></ProtectedRoute>} />
                <Route path="/credit" element={<ProtectedRoute allow={["owner", "staff"]}><CreditManagementPage /></ProtectedRoute>} />
                <Route path="/devices" element={<ProtectedRoute allow={["owner", "staff"]}><DevicesPage /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute allow={["owner", "staff"]}><ExpensesPage /></ProtectedRoute>} />
                <Route path="/warehouses" element={<ProtectedRoute allow={["owner", "staff"]}><WarehousePage /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute allow={["owner"]}><FinancePage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allow={["owner"]}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence" element={<ProtectedRoute allow={["owner"]}><AIIntelligencePage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/low-stock" element={<ProtectedRoute allow={["owner"]}><LowStockDetailPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/anomalies" element={<ProtectedRoute allow={["owner"]}><AnomalyDetailPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/predictions-risk" element={<ProtectedRoute allow={["owner"]}><PredictionsRiskPage /></ProtectedRoute>} />
                <Route path="/partners" element={<Navigate to="/people?tab=partners" replace />} />
                <Route path="/users" element={<Navigate to="/people?tab=users" replace />} />
                <Route path="/people" element={<ProtectedRoute allow={["owner"]}><PeoplePage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allow={["owner"]}><SettingsPage /></ProtectedRoute>} />
                <Route path="/reports" element={<Navigate to="/settings?tab=reports" replace />} />
                <Route path="/hr/backup" element={<Navigate to="/settings?tab=backup" replace />} />
                <Route path="/hr" element={<ProtectedRoute allow={["owner", "admin", "hr"]}><HRManagementPage /></ProtectedRoute>} />
                <Route path="/reminders" element={<ProtectedRoute allow={["owner", "staff"]}><RemindersPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to={role === "staff" ? "/products" : "/"} replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
        </div>
      </div>
      {showGuide && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border p-4 shadow-2xl" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <p className="text-sm font-semibold">Quick Guide</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Use {formatShortcut("app.commandPalette")} for command palette and {formatShortcut("app.help")} for docs.</p>
          <button className="btn-soft mt-3" onClick={() => setShowGuide(false)}>Got it</button>
        </div>
      )}
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} commands={commandItems} />
      <HelpDocsModal open={showHelp} onClose={() => setShowHelp(false)} role={role} />
      <NotificationCenter
        notifications={notifications}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
        connected={connected}
      />
      <div id="print-area" />
    </ShortcutProvider>
  );
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrandingProvider>
  );
}
