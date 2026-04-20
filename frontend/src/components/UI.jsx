import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Edit3, Eye, Loader2, Trash2, X } from "lucide-react";
import { formatPKR } from "../utils/currency";

const toneStyles = {
  indigo: { border: "#2A2D52", glow: "rgba(99,102,241,0.25)" },
  emerald: { border: "#1F3A2E", glow: "rgba(34,197,94,0.25)" },
  rose: { border: "#412325", glow: "rgba(239,68,68,0.25)" },
  amber: { border: "#3D3220", glow: "rgba(245,158,11,0.25)" },
};

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function CountUpValue({ value, duration = 0.8, formatter = (v) => v }) {
  const numericValue = Number(value) || 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      setDisplay(numericValue * progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numericValue, duration]);

  return formatter(display);
}

export function StatCard({ title, value, tone = "indigo", money = false }) {
  const cfg = toneStyles[tone] || toneStyles.indigo;
  const formatter = useMemo(() => (money ? (val) => formatPKR(Math.round(val)) : (val) => Math.round(val).toLocaleString()), [money]);
  
  // Use dark border color and inset border in both light and dark themes
  const boxShadowStyle = `0 0 0 1px ${cfg.border} inset, 0 8px 26px ${cfg.glow}`;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="panel panel-hover"
      style={{ borderColor: cfg.border, boxShadow: boxShadowStyle }}
    >
      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{title}</p>
      <p className="mt-2 text-xl font-semibold">
        <CountUpValue value={value} formatter={formatter} />
      </p>
    </motion.div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="panel text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
    </div>
  );
}

export function Modal({ title, open, onClose, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div className={`w-full ${maxWidth} rounded-xl border p-6 shadow-2xl`} style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="btn-soft px-3 py-1.5" aria-label="Close modal"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="panel p-0">
      <div className="animate-pulse space-y-2 p-4">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-10 rounded-md bg-neutral-800/50" />
        ))}
      </div>
    </div>
  );
}

export function ActionButtons({ onView, onEdit, onDelete, disableEdit = false, disableDelete = false }) {
  return (
    <div className="flex justify-end gap-2">
      <button className="icon-btn" onClick={onView} aria-label="View"><Eye size={16} /></button>
      <button className="icon-btn" onClick={onEdit} aria-label="Edit" disabled={disableEdit}><Edit3 size={16} /></button>
      <button className="icon-btn icon-btn-danger" onClick={onDelete} aria-label="Delete" disabled={disableDelete}><Trash2 size={16} /></button>
    </div>
  );
}

export function ConfirmDialog({ open, title = "Confirm Delete", description, onConfirm, onClose, loading = false }) {
  return (
    <Modal title={title} open={open} onClose={onClose} maxWidth="max-w-md">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 animate-spin" size={16} />Deleting...</> : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

export function DataTable({
  columns,
  data,
  rowKey = "id",
  rowClassName,
  emptyText = "No records found",
  searchPlaceholder = "Search records...",
  searchableColumns,
}) {
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const normalizedColumns = searchableColumns || columns.filter((col) => col.key !== "actions").map((col) => col.key);

  const filteredData = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      normalizedColumns.some((key) => {
        const value = row?.[key];
        if (value === undefined || value === null) return false;
        return String(value).toLowerCase().includes(q);
      }),
    );
  }, [data, normalizedColumns, query]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [currentPage, filteredData, rowsPerPage]);

  if (!data.length) return <EmptyState title="No records" description={emptyText} />;
  return (
    <div className="panel data-table-wrapper overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border-color)" }}>
        <input
          className="input md:max-w-xs"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span style={{ color: "var(--text-secondary)" }}>Rows per page</span>
            <select
              className="input w-20 py-2"
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value))}
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row) => (
              <tr key={row[rowKey]} className={typeof rowClassName === "function" ? rowClassName(row) : ""}>
                {columns.map((col) => (
                  <td key={`${row[rowKey]}-${col.key}`} className={`px-4 py-3 ${col.align === "right" ? "text-right" : "text-left"}`}>
                    {typeof col.render === "function" ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm" style={{ borderColor: "var(--border-color)" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          {filteredData.length === 0
            ? "No matching results"
            : `Showing ${(currentPage - 1) * rowsPerPage + 1}-${Math.min(currentPage * rowsPerPage, filteredData.length)} of ${filteredData.length}`}
        </p>
        <div className="flex items-center gap-2">
          <button className="btn-soft px-3 py-1.5" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            &lt;
          </button>
          {Array.from({ length: totalPages }).slice(0, 7).map((_, index) => {
            const page = index + 1;
            return (
              <button
                key={page}
                className="btn-soft h-8 w-8 p-0"
                onClick={() => setCurrentPage(page)}
                style={page === currentPage ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
              >
                {page}
              </button>
            );
          })}
          <button className="btn-soft px-3 py-1.5" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
}
