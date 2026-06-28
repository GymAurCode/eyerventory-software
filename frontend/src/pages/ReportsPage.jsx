import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Download, FileText, Loader2, Printer, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import api from "../api/client";
import { Modal, PageHeader, StatCard, DataTable, EmptyState, LoadingSkeleton } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { generatePDF } from "../utils/reportPdf";
import { formatPKR } from "../utils/currency";
import { warehouseApi } from "../api/warehouse";
import { REPORT_GROUPS, getReportById } from "../config/warehouseReports";
import {
  DateRangePicker, ShopFilter, ProductFilter, SalesmanFilter,
  CategoryFilter, StatusFilter, AgingFilter, MovementTypeFilter, ReturnTypeFilter, WarehouseFilter,
} from "../components/reports/ReportFilters";

const LEGACY_TYPES = [
  { id: "products",       label: "Products Report" },
  { id: "sales",          label: "Sales Report" },
  { id: "expenses",       label: "Expenses Report" },
  { id: "finance",        label: "Finance Report" },
  { id: "partner_profit", label: "Partner Profit Report" },
  { id: "credit_summary", label: "Credit Summary Report" },
];

async function downloadLegacy(reportType, fmt, companyName) {
  try {
    if (fmt === "pdf") {
      const { data } = await api.get(`/reports/data?report_type=${reportType}`);
      await generatePDF({ title: data?.title || "Report", columns: data?.columns || [], data: data?.data || [], companyName });
      toast.success("PDF generated successfully");
      return;
    }
    const res = await api.get(`/reports/export?report_type=${reportType}&fmt=${fmt}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}.${fmt === "excel" ? "xlsx" : "pdf"}`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err.response?.data?.detail || "Failed to export report");
  }
}

function PaymentModeFilter({ value, onChange }) {
  return (
    <select className="input py-1.5 text-xs w-28" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All Modes</option>
      <option value="cash">Cash</option>
      <option value="bank">Bank</option>
      <option value="jazzcash">JazzCash</option>
      <option value="easypaisa">Easypaisa</option>
    </select>
  );
}

function WarehouseReportViewer() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportInfo, setReportInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [warehouseList, setWarehouseList] = useState([]);
  const [search, setSearch] = useState("");

  const [filters, setFilters] = useState({
    warehouse_id: "", product_id: "", salesman_id: "", shop_id: "",
    category: "", movement_type: "", return_type: "", status: "",
    aging: "", payment_mode: "", date_str: "",
    start: "", end: "", days: 30, source_id: "", dest_id: "", account_id: "",
  });

  useEffect(() => {
    warehouseApi.list().then(setWarehouseList).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedReport) {
      setReportInfo(getReportById(selectedReport));
    }
  }, [selectedReport]);

  const loadReport = useCallback(async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) params[k] = v;
      });
      const result = await warehouseApi.getWarehouseReport(selectedReport, params);
      setData(result?.data || []);
      setSummary(result?.summary || null);
    } catch {
      setData([]);
      setSummary(null);
      toast.error("Failed to load report");
    }
    setLoading(false);
  }, [selectedReport, filters]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const searched = useMemo(() => {
    if (!search || !data.length) return data;
    const q = search.toLowerCase();
    return data.filter((r) => (reportInfo?.columns || []).some((c) => (r[c.key] ?? "").toString().toLowerCase().includes(q)));
  }, [data, search, reportInfo]);

  const filterPanel = reportInfo ? (
    <div className="flex flex-wrap items-center gap-2 p-3" style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius, 8px)", border: "0.5px solid var(--border-color)" }}>
      {(reportInfo.filters || []).includes("warehouse") && (
        <select className="input py-1.5 text-xs w-36" value={filters.warehouse_id}
          onChange={(e) => updateFilter("warehouse_id", e.target.value)}>
          <option value="">All Warehouses</option>
          {warehouseList.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {(reportInfo.filters || []).includes("product") && (
        <ProductFilter value={filters.product_id} onChange={(v) => updateFilter("product_id", v || "")} />
      )}
      {(reportInfo.filters || []).includes("salesman") && (
        <SalesmanFilter value={filters.salesman_id} onChange={(v) => updateFilter("salesman_id", v || "")} />
      )}
      {(reportInfo.filters || []).includes("shop") && (
        <ShopFilter value={filters.shop_id} onChange={(v) => updateFilter("shop_id", v || "")} />
      )}
      {(reportInfo.filters || []).includes("category") && (
        <CategoryFilter value={filters.category} onChange={(v) => updateFilter("category", v)} />
      )}
      {(reportInfo.filters || []).includes("movementType") && (
        <MovementTypeFilter value={filters.movement_type} onChange={(v) => updateFilter("movement_type", v)} />
      )}
      {(reportInfo.filters || []).includes("returnType") && (
        <ReturnTypeFilter value={filters.return_type} onChange={(v) => updateFilter("return_type", v)} />
      )}
      {(reportInfo.filters || []).includes("status") && (
        <StatusFilter value={filters.status} onChange={(v) => updateFilter("status", v)} />
      )}
      {(reportInfo.filters || []).includes("aging") && (
        <AgingFilter value={filters.aging} onChange={(v) => updateFilter("aging", v)} />
      )}
      {(reportInfo.filters || []).includes("paymentMode") && (
        <PaymentModeFilter value={filters.payment_mode} onChange={(v) => updateFilter("payment_mode", v)} />
      )}
      {(reportInfo.filters || []).includes("dateRange") && (
        <DateRangePicker value={{ start: filters.start, end: filters.end }}
          onChange={({ start, end }) => { setFilters((prev) => ({ ...prev, start, end })); }} />
      )}
      {(reportInfo.filters || []).includes("date") && (
        <input className="input py-1.5 text-xs w-36" type="date" value={filters.date_str}
          onChange={(e) => updateFilter("date_str", e.target.value)} placeholder="Date" />
      )}
      <button onClick={loadReport} disabled={loading} className="btn-soft text-xs flex items-center gap-1">
        <RefreshCw size={12} /> {loading ? "Loading..." : "Run"}
      </button>
    </div>
  ) : null;

  const totalRow = reportInfo?.summary ? reportInfo.summary(searched) : null;

  return (
    <div className="flex gap-4">
      <div className="w-48 shrink-0 space-y-1">
        {REPORT_GROUPS.map((group) => (
          <div key={group.id}>
            <div className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5"
              style={{ color: "var(--text-secondary)" }}>
              {group.label}
            </div>
            {group.reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className="w-full text-left text-xs px-3 py-1 rounded transition-all"
                style={{
                  background: selectedReport === r.id ? "var(--bg-elevated)" : "transparent",
                  color: selectedReport === r.id ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: selectedReport === r.id ? 600 : 400,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {reportInfo && (
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{reportInfo.label}</div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..." className="input py-1 pl-7 pr-2 text-xs w-32" />
              </div>
              <button onClick={() => { if (searched.length) { const header = reportInfo.columns.map((c) => `"${c.label}"`).join(","); const body = searched.map((r) => reportInfo.columns.map((c) => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${selectedReport}.csv`; a.click(); URL.revokeObjectURL(url); toast.success("CSV exported"); }}}
                className="btn-soft px-2 py-1" title="Export CSV"><Download size={12} /></button>
              <button onClick={() => window.print()} className="btn-soft px-2 py-1" title="Print"><Printer size={12} /></button>
            </div>
          </div>
        )}
        {filterPanel}
        {loading ? <LoadingSkeleton rows={8} /> : !selectedReport ? (
          <EmptyState title="Select a Report" description="Choose a report from the sidebar to view" />
        ) : searched.length === 0 ? (
          <EmptyState title="No data" description="Adjust filters and run the report" />
        ) : (
          <>
            <DataTable data={searched} columns={reportInfo?.columns || []} />
            {totalRow && (
              <div className="flex items-center justify-between rounded-lg px-4 py-2 text-xs font-semibold"
                style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border-color)" }}>
                {typeof totalRow === "string" ? <span>{totalRow}</span> : totalRow}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Import modal (from legacy ReportsPage) ──

const ACTION_STYLE = {
  inserted: "bg-green-100 text-green-700",
  updated:  "bg-blue-100 text-blue-700",
  failed:   "bg-red-100 text-red-700",
};

function ImportModal({ onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("pick");

  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const { data } = await api.post("/products/import/preview", form);
      setPreview(data);
      setStep("preview");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/products/import", form);
      setResult(data);
      setStep("result");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/products/import/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "products_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  };

  const downloadErrorReport = () => {
    if (!result) return;
    const failed = result.rows.filter((r) => r.action === "failed");
    const lines = ["row,sku,name,error", ...failed.map((r) => `${r.row},"${r.sku}","${r.name}","${r.error}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep("pick");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Modal title="Import Products (Excel)" open onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {step === "pick" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              Upload an <strong>.xlsx</strong> file with columns: <code>sku, name, price, quantity, category</code>.
              Existing products (matched by SKU) will be updated; new ones will be inserted.
            </p>
            <div className="flex items-center gap-3">
              <label className="btn-primary cursor-pointer text-sm">
                Choose File
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              </label>
              <button className="btn-soft text-sm" onClick={downloadTemplate}>↓ Download Template</button>
            </div>
            {loading && <p className="text-sm text-[var(--text-muted)] animate-pulse">Parsing file…</p>}
          </div>
        )}
        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Preview — {file?.name}</p>
              <button className="text-xs text-[var(--text-muted)] hover:underline" onClick={reset}>Change file</button>
            </div>
            {preview.warnings?.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 space-y-0.5">
                {preview.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
              </div>
            )}
            <div className="overflow-auto rounded-lg border text-xs" style={{ borderColor: "var(--border-color)", maxHeight: 320 }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                    {preview.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold capitalize">{h}</th>
                    ))}
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className={`border-b last:border-0 ${row._error ? "bg-red-50" : ""}`} style={{ borderColor: "var(--border-color)" }}>
                      {preview.headers.map((h) => (
                        <td key={h} className="px-3 py-1.5">{row[h] ?? "—"}</td>
                      ))}
                      <td className="px-3 py-1.5">
                        {row._error ? <span className="text-red-500">✗ {row._error}</span> : <span className="text-green-600">✓ valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)]">Showing first {preview.rows.length} rows.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-soft" onClick={reset}>Cancel</button>
              <button className="btn-primary" onClick={handleImport} disabled={loading || preview.warnings?.some((w) => w.includes("Missing required"))}>
                {loading ? "Importing…" : "Confirm Import"}
              </button>
            </div>
          </div>
        )}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <StatCard title="Total"   value={result.total}   icon="ti-file-import" />
              <StatCard title="Added"   value={result.inserted} tone="emerald" icon="ti-circle-check" />
              <StatCard title="Updated" value={result.updated} tone="indigo" icon="ti-refresh" />
              <StatCard title="Failed"  value={result.failed}  tone="rose" icon="ti-alert-circle" />
            </div>
            <div className="overflow-auto rounded-lg border text-xs" style={{ borderColor: "var(--border-color)", maxHeight: 280 }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-3 py-1.5 text-[var(--text-muted)]">{r.row}</td>
                      <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                      <td className="px-3 py-1.5 max-w-[160px] truncate">{r.name}</td>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${ACTION_STYLE[r.action] || ""}`}>{r.action}</span>
                      </td>
                      <td className="px-3 py-1.5 text-red-500">{r.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center pt-1">
              {result.failed > 0 && (
                <button className="btn-soft text-xs text-red-500" onClick={downloadErrorReport}>↓ Download Error Report (CSV)</button>
              )}
              <div className="flex gap-2 ml-auto">
                <button className="btn-soft" onClick={reset}>Import Another</button>
                <button className="btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main page ──

export default function ReportsPage({ embedded = false }) {
  const { companyName } = useBranding();
  const [showImport, setShowImport] = useState(false);
  const [view, setView] = useState("warehouse"); // "legacy" | "warehouse"

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="Reports Center"
          subtitle={`${companyName} — legacy reports, warehouse analytics, and product import`}
          actions={
            <div className="flex items-center gap-2">
              <div className="rounded-lg flex p-0.5" style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border-color)" }}>
                <button onClick={() => setView("legacy")} className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={{ background: view === "legacy" ? "var(--accent)" : "transparent", color: view === "legacy" ? "#fff" : "var(--text-secondary)" }}>
                  Legacy
                </button>
                <button onClick={() => setView("warehouse")} className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                  style={{ background: view === "warehouse" ? "var(--accent)" : "transparent", color: view === "warehouse" ? "#fff" : "var(--text-secondary)" }}>
                  Warehouse
                </button>
              </div>
              <button className="btn-primary text-sm" onClick={() => setShowImport(true)}>
                ↑ Import Products (Excel)
              </button>
            </div>
          }
        />
      )}

      {view === "legacy" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {LEGACY_TYPES.map((item) => (
            <div key={item.id} className="panel flex items-center justify-between">
              <p className="font-medium">{item.label}</p>
              <div className="space-x-2">
                <button className="btn-soft" onClick={() => downloadLegacy(item.id, "pdf", companyName)}>PDF</button>
                <button className="btn-soft" onClick={() => downloadLegacy(item.id, "excel", companyName)}>Excel</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <WarehouseReportViewer />
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
