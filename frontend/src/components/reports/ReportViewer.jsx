import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { DataTable, EmptyState, LoadingSkeleton } from "../UI";
import api from "../../api/client";
import { formatPKR } from "../../utils/currency";

export default function ReportViewer({ reportId, reportLabel, fetchFn, columns, filters, summaryRow }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFn();
      const rows = result?.data || result || [];
      setData(rows);
      setSummary(result?.summary || null);
    } catch {
      setData([]);
      toast.error("Failed to load report");
    }
    setLoading(false);
  }, [fetchFn]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    if (!data.length) return;
    const header = columns.map((c) => `"${c.label}"`).join(",");
    const body = data.map((r) => columns.map((c) => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${reportId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportExcel = async () => {
    try {
      const res = await api.post("/reports/export/excel", { report_id: reportId, filters }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `${reportId}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exported");
    } catch { toast.error("Excel export failed"); }
  };

  const handlePrint = () => window.print();

  const searched = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => columns.some((c) => (r[c.key] ?? "").toString().toLowerCase().includes(q)));
  }, [data, search, columns]);

  const totalRow = summaryRow?.(data, summary);

  return (
    <div className="space-y-3">
      {filters}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{reportLabel}</h3>
          {!loading && <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>({data.length} results)</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..." className="input py-1 pl-7 pr-2 text-xs w-32" />
          </div>
          <button onClick={load} disabled={loading}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black flex items-center gap-1"
            style={{ background: "var(--accent)" }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {loading ? "Loading..." : "Run Report"}
          </button>
          <div className="w-px h-5" style={{ background: "var(--border-color)" }} />
          <button onClick={exportCSV} disabled={!data.length} className="btn-soft px-2 py-1.5" title="Export CSV">
            <Download size={12} />
          </button>
          <button onClick={exportExcel} disabled={!data.length} className="btn-soft px-2 py-1.5" title="Export Excel">
            <FileSpreadsheet size={12} />
          </button>
          <button onClick={handlePrint} disabled={!data.length} className="btn-soft px-2 py-1.5" title="Print">
            <Printer size={12} />
          </button>
        </div>
      </div>

      {loading ? <LoadingSkeleton rows={8} /> : searched.length === 0 ? (
        <EmptyState title="No data" description="Adjust filters and run the report" />
      ) : (
        <>
          <DataTable data={searched} columns={columns} defaultSort={columns.find((c) => c.defaultSort)?.key} />
          {totalRow && (
            <div className="flex items-center justify-between rounded-lg px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border-color)" }}>
              {totalRow}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function formatVal(val, type) {
  if (val === null || val === undefined) return "-";
  if (type === "money") return formatPKR(val);
  if (type === "date") return new Date(val).toLocaleDateString();
  if (type === "qty") return Number(val).toLocaleString();
  return val;
}
