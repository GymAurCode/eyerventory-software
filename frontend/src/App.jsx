import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import CommandPalette from "./components/CommandPalette";
import HelpDocsModal from "./components/HelpDocsModal";
import NotificationCenter from "./components/NotificationCenter";
import { SIDEBAR_ITEMS } from "./config/navigation";
import { COMMAND_ITEMS, formatShortcut } from "./config/shortcuts";
import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import FinancePage from "./pages/FinancePage";
import AccountingPage from "./pages/AccountingPage";
import LoginPage from "./pages/LoginPage";
import PeoplePage from "./pages/PeoplePage";
import ProductsPage from "./pages/ProductsPage";
import PurchasesPage from "./pages/PurchasesPage";
import SalesPage from "./pages/SalesPage";
import SettingsPage from "./pages/SettingsPage";
import CreditManagementPage from "./pages/CreditManagementPage";
import HRManagementPage from "./pages/hr/HRManagementPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BrandingProvider, useBranding } from "./contexts/BrandingContext";
import { ShortcutProvider } from "./contexts/ShortcutContext";
import { useTheme } from "./contexts/ThemeContext";
import { useShortcutManager } from "./hooks/useShortcutManager";
import { useReminderWebSocket } from "./hooks/useReminderWebSocket";

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
  const { token, logout, role, name } = useAuth();
  const { companyName } = useBranding();
  const { toggleTheme, theme } = useTheme();
  const [collapsed, setCollapsed] = useState(localStorage.getItem("sidebar_collapsed") === "1");
  const [showPalette, setShowPalette] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarItems = useMemo(() => SIDEBAR_ITEMS.filter((item) => item.roles.includes(role)), [role]);

  // Real-time reminder notifications
  const { notifications, dismiss, dismissAll, connected } = useReminderWebSocket(token);

  // For HashRouter, extract the current path from hash
  const currentPath = location.hash ? location.hash.slice(1) : "/";

  const dispatchAction = (actionId) => {
    if (actionId === "app.commandPalette") return setShowPalette(true), true;
    if (actionId === "app.help") return setShowHelp(true), true;
    if (actionId === "app.themeToggle") return toggleTheme(), true;
    if (actionId === "nav.dashboard" && role === "owner") return navigate("/"), true;
    if (actionId === "nav.products") return navigate("/products"), true;
    if (actionId === "nav.sales") return navigate("/sales"), true;
    if (actionId === "nav.credit") return navigate("/credit"), true;
    if (actionId === "nav.expenses") return navigate("/expenses"), true;
    if (actionId === "nav.finance" && role === "owner") return navigate("/finance"), true;
    if (actionId === "nav.accounting" && role === "owner") return navigate("/accounting"), true;
    if (actionId === "nav.analytics" && role === "owner") return navigate("/analytics"), true;
    if (actionId === "nav.ai" && role === "owner") return navigate("/ai-intelligence"), true;
    if (actionId === "nav.reminders") return navigate("/reminders"), true;
    if (actionId === "nav.users" && role === "owner") return navigate("/people"), true;
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

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  if (!token) return <LoginPage />;

  const shortcutApi = { registerPageAction, triggerAction, activeActionId, formatShortcut };

  return (
    <ShortcutProvider value={shortcutApi}>
      <div className="h-screen overflow-hidden" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((s) => !s)} items={sidebarItems} companyName={companyName} />
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b px-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{currentPath}</p>
              <p className="text-sm font-semibold">{companyName}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ border: "1px solid var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{name} ({role})</span>
              <button className={`btn-soft ${activeActionId === "app.help" ? "ring-2 ring-indigo-500" : ""}`} title={`Help (${formatShortcut("app.help")})`} onClick={() => setShowHelp(true)}>?</button>
              <button className="btn-soft" onClick={toggleTheme}>{theme === "dark" ? "Light" : "Dark"} Mode</button>
              <button onClick={logout} className="btn-soft">Logout</button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Suspense fallback={<div className="panel">Loading analytics...</div>}>
              <Routes>
                <Route path="/" element={<ProtectedRoute allow={["owner"]}><DashboardPage /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute allow={["owner", "staff"]}><ProductsPage /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute allow={["owner", "staff"]}><SalesPage /></ProtectedRoute>} />
                <Route path="/purchases" element={<ProtectedRoute allow={["owner", "staff"]}><PurchasesPage /></ProtectedRoute>} />
                <Route path="/credit" element={<ProtectedRoute allow={["owner", "staff"]}><CreditManagementPage /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute allow={["owner", "staff"]}><ExpensesPage /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute allow={["owner"]}><FinancePage /></ProtectedRoute>} />
                <Route path="/accounting" element={<ProtectedRoute allow={["owner"]}><AccountingPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allow={["owner"]}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence" element={<ProtectedRoute allow={["owner"]}><AIIntelligencePage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/low-stock" element={<ProtectedRoute allow={["owner"]}><LowStockDetailPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/anomalies" element={<ProtectedRoute allow={["owner"]}><AnomalyDetailPage /></ProtectedRoute>} />
                <Route path="/ai-intelligence/predictions-risk" element={<ProtectedRoute allow={["owner"]}><PredictionsRiskPage /></ProtectedRoute>} />
                <Route path="/partners" element={<Navigate to="/people?tab=partners" replace />} />
                <Route path="/users" element={<Navigate to="/people?tab=users" replace />} />
                <Route path="/people" element={<ProtectedRoute allow={["owner"]}><PeoplePage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allow={["owner"]}><SettingsPage /></ProtectedRoute>} />
                {/* Legacy redirects — keep old URLs working */}
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
