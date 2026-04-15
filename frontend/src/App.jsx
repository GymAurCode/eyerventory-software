import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import CommandPalette from "./components/CommandPalette";
import HelpDocsModal from "./components/HelpDocsModal";
import { SIDEBAR_ITEMS } from "./config/navigation";
import { COMMAND_ITEMS, formatShortcut } from "./config/shortcuts";
import DashboardPage from "./pages/DashboardPage";
import ExpensesPage from "./pages/ExpensesPage";
import FinancePage from "./pages/FinancePage";
import LoginPage from "./pages/LoginPage";
import PartnersPage from "./pages/PartnersPage";
import ProductsPage from "./pages/ProductsPage";
import ReportsPage from "./pages/ReportsPage";
import SalesPage from "./pages/SalesPage";
import SettingsPage from "./pages/SettingsPage";
import UsersPage from "./pages/UsersPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BrandingProvider, useBranding } from "./contexts/BrandingContext";
import { ShortcutProvider } from "./contexts/ShortcutContext";
import { useTheme } from "./contexts/ThemeContext";
import { useShortcutManager } from "./hooks/useShortcutManager";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));

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

  const dispatchAction = (actionId) => {
    if (actionId === "app.commandPalette") return setShowPalette(true), true;
    if (actionId === "app.help") return setShowHelp(true), true;
    if (actionId === "app.themeToggle") return toggleTheme(), true;
    if (actionId === "nav.dashboard" && role === "owner") return navigate("/"), true;
    if (actionId === "nav.products") return navigate("/products"), true;
    if (actionId === "nav.sales") return navigate("/sales"), true;
    if (actionId === "nav.expenses") return navigate("/expenses"), true;
    if (actionId === "nav.finance" && role === "owner") return navigate("/finance"), true;
    if (actionId === "nav.analytics" && role === "owner") return navigate("/analytics"), true;
    if (actionId === "nav.users" && role === "owner") return navigate("/users"), true;
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
    const key = "eyerventory_guide_seen";
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
      <div className="min-h-screen" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      <div className="flex min-h-screen">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((s) => !s)} items={sidebarItems} companyName={companyName} />
        <div className="flex-1">
          <header className="flex h-16 items-center justify-between border-b px-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{location.pathname}</p>
              <p className="text-sm font-semibold">{companyName}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ border: "1px solid var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>{name} ({role})</span>
              <button className={`btn-soft ${activeActionId === "app.help" ? "ring-2 ring-indigo-500" : ""}`} title={`Help (${formatShortcut("app.help")})`} onClick={() => setShowHelp(true)}>?</button>
              <button className="btn-soft" onClick={toggleTheme}>{theme === "dark" ? "Light" : "Dark"} Mode</button>
              <button onClick={logout} className="btn-soft">Logout</button>
            </div>
          </header>
          <main className="p-6">
            <Suspense fallback={<div className="panel">Loading analytics...</div>}>
              <Routes>
                <Route path="/" element={<ProtectedRoute allow={["owner"]}><DashboardPage /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute allow={["owner", "staff"]}><ProductsPage /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute allow={["owner", "staff"]}><SalesPage /></ProtectedRoute>} />
                <Route path="/expenses" element={<ProtectedRoute allow={["owner", "staff"]}><ExpensesPage /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute allow={["owner"]}><FinancePage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allow={["owner"]}><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/partners" element={<ProtectedRoute allow={["owner"]}><PartnersPage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allow={["owner"]}><UsersPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allow={["owner"]}><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allow={["owner"]}><SettingsPage /></ProtectedRoute>} />
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
