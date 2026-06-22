import { useRef, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";
import { Modal, PageHeader, StatCard } from "../components/UI";
import { useBranding } from "../contexts/BrandingContext";
import { generatePDF } from "../utils/reportPdf";

const TYPES = [
  { id: "products",       label: "Products Report" },
  { id: "sales",          label: "Sales Report" },
  { id: "expenses",       label: "Expenses Report" },
  { id: "finance",        label: "Finance Report" },
  { id: "partner_profit", label: "Partner Profit Report" },
  { id: "credit_summary", label: "Credit Summary Report" },
];

async function download(reportType, fmt, companyName) {
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

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------

const ACTION_STYLE = {
  inserted: "bg-green-100 text-green-700",
  updated:  "bg-blue-100 text-blue-700",
  failed:   "bg-red-100 text-red-700",
};

function ImportModal({ onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);   // { headers, rows, warnings }
  const [result, setResult] = useState(null);     // ImportSummary
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("pick");       // pick | preview | result

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

        {/* Step: pick file */}
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

        {/* Step: preview */}
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
                  <tr className="border-b bg-[var(--surface-2,rgba(0,0,0,0.04))]" style={{ borderColor: "var(--border-color)" }}>
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
                        {row._error
                          ? <span className="text-red-500">✗ {row._error}</span>
                          : <span className="text-green-600">✓ valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[var(--text-muted)]">Showing first {preview.rows.length} rows.</p>

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-soft" onClick={reset}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={loading || preview.warnings?.some((w) => w.includes("Missing required"))}
              >
                {loading ? "Importing…" : "Confirm Import"}
              </button>
            </div>
          </div>
        )}

        {/* Step: result */}
        {step === "result" && result && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard title="Total"   value={result.total}   icon="ti-file-import" />
              <StatCard title="Added"   value={result.inserted} tone="emerald" icon="ti-circle-check" />
              <StatCard title="Updated" value={result.updated} tone="indigo" icon="ti-refresh" />
              <StatCard title="Failed"  value={result.failed}  tone="rose" icon="ti-alert-circle" />
            </div>

            {/* Per-row results */}
            <div className="overflow-auto rounded-lg border text-xs" style={{ borderColor: "var(--border-color)", maxHeight: 280 }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-[var(--surface-2,rgba(0,0,0,0.04))]" style={{ borderColor: "var(--border-color)" }}>
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
                        <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${ACTION_STYLE[r.action] || ""}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-red-500">{r.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-1">
              {result.failed > 0 && (
                <button className="btn-soft text-xs text-red-500" onClick={downloadErrorReport}>
                  ↓ Download Error Report (CSV)
                </button>
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReportsPage({ embedded = false }) {
  const { companyName } = useBranding();
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="Professional Reports"
          subtitle={`${companyName} — export reports or bulk-import products`}
          actions={
            <button className="btn-primary text-sm" onClick={() => setShowImport(true)}>
              ↑ Import Products (Excel)
            </button>
          }
        />
      )}
      {embedded && (
        <div className="flex justify-end">
          <button className="btn-primary text-sm" onClick={() => setShowImport(true)}>
            ↑ Import Products (Excel)
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {TYPES.map((item) => (
          <div key={item.id} className="panel flex items-center justify-between">
            <p className="font-medium">{item.label}</p>
            <div className="space-x-2">
              <button className="btn-soft" onClick={() => download(item.id, "pdf", companyName)}>PDF</button>
              <button className="btn-soft" onClick={() => download(item.id, "excel", companyName)}>Excel</button>
            </div>
          </div>
        ))}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
