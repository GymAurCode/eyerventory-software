import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowLeftRight, BarChart3, ClipboardCheck,
  Eye, FileSpreadsheet, MinusCircle, Package, Plus, RotateCcw,
  ArrowLeft,
} from "lucide-react";
import { warehouseApi } from "../api/warehouse";
import { PageHeader } from "../components/UI";
import {
  AdjustmentDialog, CycleCountDialog, DamageDialog, Reports,
  StockInDialog, StockLedger, StockOutDialog, TransferDialog,
  WarehouseDashboard,
} from "../components/warehouse";
import ExcelWorkspace from "../components/ExcelWorkspace";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "stock-in", label: "Stock In", icon: Package },
  { id: "stock-out", label: "Stock Out", icon: MinusCircle },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "adjustments", label: "Adjustments", icon: RotateCcw },
  { id: "damage", label: "Damage", icon: AlertTriangle },
  { id: "cycle-count", label: "Cycle Count", icon: ClipboardCheck },
  { id: "ledger", label: "Stock Ledger", icon: Eye },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "excel", label: "Excel Workspace", icon: FileSpreadsheet },
];

const TAB_ICONS = {
  dashboard: BarChart3, "stock-in": Package, "stock-out": MinusCircle,
  transfers: ArrowLeftRight, adjustments: RotateCcw, damage: AlertTriangle,
  "cycle-count": ClipboardCheck, ledger: Eye, reports: BarChart3, excel: FileSpreadsheet,
};

export default function WarehousePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialog, setDialog] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const actionButtons = activeTab !== "excel" && activeTab !== "ledger" && activeTab !== "reports" && activeTab !== "dashboard" ? (
    <button
      onClick={() => setDialog(activeTab === "stock-in" ? "stock-in" : activeTab === "stock-out" ? "stock-out" : activeTab === "transfers" ? "transfer" : activeTab === "adjustments" ? "adjustment" : activeTab === "damage" ? "damage" : activeTab === "cycle-count" ? "cycle-count" : null)}
      className="btn-primary text-sm flex items-center gap-1.5"
    >
      <Plus size={14} />
      New {activeTab.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
    </button>
  ) : undefined;

  const TabIcon = TAB_ICONS[activeTab] || BarChart3;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouse Management"
        subtitle="Manage stock, transfers, and inventory"
        actions={actionButtons}
      />

      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "var(--accent)" : "var(--bg-elevated)",
                color: activeTab === tab.id ? "#000" : "var(--text-secondary)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + refreshKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "dashboard" && <WarehouseDashboard key={refreshKey} />}
          {activeTab === "stock-in" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Stock In" above to receive inventory</p>
            </div>
          )}
          {activeTab === "stock-out" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <MinusCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Stock Out" above to issue inventory</p>
            </div>
          )}
          {activeTab === "transfers" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <ArrowLeftRight size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Transfer" above to move stock between warehouses</p>
            </div>
          )}
          {activeTab === "adjustments" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <RotateCcw size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Adjustment" above to correct stock levels</p>
            </div>
          )}
          {activeTab === "damage" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Damage" above to report damaged inventory</p>
            </div>
          )}
          {activeTab === "cycle-count" && (
            <div className="panel p-4 text-center" style={{ color: "var(--text-secondary)" }}>
              <ClipboardCheck size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click "New Cycle Count" above to start counting</p>
            </div>
          )}
          {activeTab === "ledger" && <StockLedger key={refreshKey} />}
          {activeTab === "reports" && <Reports key={refreshKey} />}
          {activeTab === "excel" && (
            <div className="panel" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
              <ExcelWorkspace onClose={() => setActiveTab("dashboard")} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Dialogs ──────────────────────────────────────────── */}
      <StockInDialog
        open={dialog === "stock-in"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
      <StockOutDialog
        open={dialog === "stock-out"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
      <TransferDialog
        open={dialog === "transfer"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
      <AdjustmentDialog
        open={dialog === "adjustment"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
      <DamageDialog
        open={dialog === "damage"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
      <CycleCountDialog
        open={dialog === "cycle-count"}
        onClose={() => setDialog(null)}
        onSaved={triggerRefresh}
      />
    </div>
  );
}
