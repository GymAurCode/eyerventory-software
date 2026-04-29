import { useRef, useState } from "react";
import { toast } from "sonner";
import api from "../api/client";

/**
 * Reusable bulk product import panel.
 * Props:
 *   onImportDone — called after a successful import so parent can refresh data
 */
export default function BulkImportPanel({ onImportDone }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null); // BulkImportResult | null
  const [error, setError] = useState("");

  // ── Template download ───────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const res = await api.get("/products/bulk-import/template", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "products_import_template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  const upload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Only .xlsx files are accepted. Please use the provided template.");
      return;
    }
    setError("");
    setResult(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/products/bulk-import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (data.failed === 0) {
        toast.success(`Import complete — ${data.created} created, ${data.updated} updated`);
      } else {
        toast.warning(`Import done with ${data.failed} failed row(s)`);
      }
      if (onImportDone) onImportDone();
    } catch (err) {
      const msg = err.response?.data?.detail || "Import failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFileChange = (e) => upload(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files?.[0]);
  };

  // ── Error report download ───────────────────────────────────────────────────
  const downloadErrorReport = () => {
    if (!result?.errors?.length) return;
    const lines = ["Row,SKU,Reason", ...result.errors.map((e) => `${e.row},${e.sku},"${e.reason}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import_errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Step 1 — template */}
      <div className="panel space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Step 1 — Download Template</p>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              Fill in the template with your product data. Required columns:
              <span className="ml-1 font-mono text-xs">product_name, sku, category, purchase_price, sale_price, stock_quantity</span>
            </p>
          </div>
          <button className="btn-soft shrink-0" onClick={downloadTemplate}>
            ⬇ Download Template
          </button>
        </div>
      </div>

      {/* Step 2 — upload */}
      <div className="panel space-y-3">
        <p className="font-semibold">Step 2 — Upload Filled File</p>

        {/* Drop zone */}
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-all"
          style={{
            borderColor: dragging ? "var(--accent)" : "var(--border-color)",
            background: dragging ? "color-mix(in srgb, var(--accent) 6%, var(--bg-card))" : "var(--bg-elevated)",
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Importing…</p>
            </div>
          ) : (
            <>
              <p className="text-3xl">📂</p>
              <p className="mt-2 text-sm font-medium">Drop your .xlsx file here or click to browse</p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Max 5 MB · .xlsx only</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFileChange} />

        {error && (
          <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#EF4444" }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* Step 3 — results */}
      {result && (
        <div className="panel space-y-3">
          <p className="font-semibold">Import Results</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Rows", value: result.total, color: "var(--text-primary)" },
              { label: "Created",    value: result.created, color: "#22C55E" },
              { label: "Updated",    value: result.updated, color: "#6366F1" },
              { label: "Failed",     value: result.failed,  color: result.failed > 0 ? "#EF4444" : "var(--text-secondary)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border p-3 text-center" style={{ borderColor: "var(--border-color)" }}>
                <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium" style={{ color: "#EF4444" }}>Failed Rows</p>
                <button className="btn-soft text-xs" onClick={downloadErrorReport}>⬇ Download Error Report</button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border text-xs" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full">
                  <thead style={{ background: "var(--bg-elevated)" }}>
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border-color)" }}>
                        <td className="px-3 py-2">{e.row}</td>
                        <td className="px-3 py-2 font-mono">{e.sku}</td>
                        <td className="px-3 py-2" style={{ color: "#EF4444" }}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
