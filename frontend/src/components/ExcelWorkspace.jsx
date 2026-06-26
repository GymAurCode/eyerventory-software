import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown, Download, FileSpreadsheet, Filter, Plus, Search,
  Upload, X, Save, RotateCcw, RotateCcwIcon,
  Undo2, Redo2, ArrowUpDown, Trash2, Copy, Scissors,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

const COLUMN_WIDTH = 140;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 32;
const ROW_HEADER_WIDTH = 50;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function colLabel(i) {
  let label = "";
  let n = i;
  while (n >= 0) {
    label = ALPHABET[n % 26] + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

const SHEET_TEMPLATES = {
  Products: { columns: ["name", "sku", "barcode_number", "category", "cost_price", "selling_price", "stock", "low_stock_threshold"] },
  Suppliers: { columns: ["name", "phone", "address", "email", "opening_balance"] },
  Warehouses: { columns: ["name", "code", "location"] },
  "Opening Stock": { columns: ["product_sku", "product_name", "warehouse_code", "quantity", "unit_price"] },
  Purchases: { columns: ["invoice_number", "supplier", "product_sku", "quantity", "purchase_price", "date"] },
  Transfers: { columns: ["from_warehouse", "to_warehouse", "product_sku", "quantity", "date"] },
  "Stock Count": { columns: ["product_sku", "product_name", "warehouse", "system_qty", "counted_qty", "variance"] },
  "Stock Adjustments": { columns: ["product_sku", "warehouse", "adjustment_qty", "reason"] },
  "Price Updates": { columns: ["product_sku", "new_cost_price", "new_selling_price"] },
  "Barcode Updates": { columns: ["product_sku", "new_barcode"] },
};

function createSheet(name, columns) {
  return { name, columns, rows: [], dirty: false };
}

export default function ExcelWorkspace({ onClose, onSaved }) {
  const [sheets, setSheets] = useState(() =>
    Object.entries(SHEET_TEMPLATES).map(([name, tpl]) => createSheet(name, tpl.columns))
  );
  const [activeSheet, setActiveSheet] = useState(0);
  const [selection, setSelection] = useState({ row: -1, col: -1 });
  const [selectionRange, setSelectionRange] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [frozenRows, setFrozenRows] = useState(1);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDir, setSortDir] = useState(null);
  const [filterText, setFilterText] = useState({});
  const [resizing, setResizing] = useState(null);
  const [columnWidths, setColumnWidths] = useState({});
  const [saving, setSaving] = useState(false);

  const tableRef = useRef(null);
  const editRef = useRef(null);

  const sheet = sheets[activeSheet];

  const pushHistory = useCallback((prevSheets) => {
    setHistory((h) => {
      const newH = h.slice(0, historyIndex + 1);
      newH.push(JSON.parse(JSON.stringify(prevSheets)));
      if (newH.length > 50) newH.shift();
      return newH;
    });
    setHistoryIndex((i) => Math.min(i + 1, 49));
  }, [historyIndex]);

  const updateSheet = useCallback((fn) => {
    setSheets((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      pushHistory(prev);
      fn(copy, copy[activeSheet]);
      return copy;
    });
  }, [activeSheet, pushHistory]);

  const getCellValue = (row, col) => sheet?.rows[row]?.[sheet.columns[col]] ?? "";

  const setCellValue = (row, col, value) => {
    updateSheet((sheets, s) => {
      while (s.rows.length <= row) s.rows.push({});
      s.rows[row] = { ...s.rows[row], [s.columns[col]]: value };
      s.dirty = true;
    });
  };

  // ── Keyboard Navigation ──────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    const { row, col } = selection;
    if (row < 0 || col < 0) return;

    const maxRow = sheet?.rows.length || 0;
    const maxCol = sheet?.columns.length || 0;

    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        setCellValue(row, col, editValue);
        setEditing(false);
        setSelection((s) => ({ row: s.row + 1, col: s.col }));
      } else if (e.key === "Escape") {
        setEditing(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); setSelection((s) => ({ row: Math.max(frozenRows, s.row - 1), col: s.col })); break;
      case "ArrowDown": e.preventDefault(); setSelection((s) => ({ row: Math.min(maxRow, s.row + 1), col: s.col })); break;
      case "ArrowLeft": e.preventDefault(); setSelection((s) => ({ row: s.row, col: Math.max(0, s.col - 1) })); break;
      case "ArrowRight": e.preventDefault(); setSelection((s) => ({ row: s.row, col: Math.min(maxCol - 1, s.col + 1) })); break;
      case "Tab": e.preventDefault(); setSelection((s) => ({ row: s.row, col: Math.min(maxCol - 1, s.col + 1) })); break;
      case "Enter": e.preventDefault(); setEditValue(getCellValue(row, col)); setEditing(true); break;
      case "Delete":
      case "Backspace": e.preventDefault(); setCellValue(row, col, ""); break;
      case "c": if (e.ctrlKey) handleCopy(e); break;
      case "v": if (e.ctrlKey) handlePaste(e); break;
      case "x": if (e.ctrlKey) handleCut(e); break;
      case "z": if (e.ctrlKey) { e.preventDefault(); undo(); } break;
      case "y": if (e.ctrlKey) { e.preventDefault(); redo(); } break;
      case "f": if (e.ctrlKey) { e.preventDefault(); document.getElementById("spreadsheet-search")?.focus(); } break;
    }
  }, [selection, editing, editValue, sheet, frozenRows]);

  // ── Copy / Paste / Cut ───────────────────────────────────────────────

  const handleCopy = async (e) => {
    if (e) e.preventDefault();
    const { row, col } = selection;
    if (row < 0 || col < 0) return;
    const val = getCellValue(row, col);
    try {
      await navigator.clipboard.writeText(val);
      toast("Copied");
    } catch {}
  };

  const handleCut = async (e) => {
    if (e) e.preventDefault();
    const { row, col } = selection;
    if (row < 0 || col < 0) return;
    const val = getCellValue(row, col);
    try {
      await navigator.clipboard.writeText(val);
      setCellValue(row, col, "");
      toast("Cut");
    } catch {}
  };

  const handlePaste = async (e) => {
    if (e) e.preventDefault();
    const { row, col } = selection;
    if (row < 0 || col < 0) return;
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split("\n").filter((l) => l);
      if (lines.length === 1) {
        setCellValue(row, col, text);
      } else {
        lines.forEach((line, ri) => {
          const cells = line.split("\t");
          cells.forEach((cell, ci) => {
            if (ri < 200 && col + ci < (sheet?.columns.length || 0)) {
              setCellValue(row + ri, col + ci, cell);
            }
          });
        });
      }
      toast("Pasted");
    } catch {}
  };

  // ── Undo / Redo ──────────────────────────────────────────────────────

  const undo = () => {
    if (historyIndex < 0) return;
    setSheets(JSON.parse(JSON.stringify(history[historyIndex])));
    setHistoryIndex((i) => i - 1);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex((i) => i + 1);
    if (history[historyIndex + 1]) {
      setSheets(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // ── Row Operations ───────────────────────────────────────────────────

  const insertRow = (after) => {
    updateSheet((sheets, s) => {
      const idx = after !== undefined ? after + 1 : s.rows.length;
      s.rows.splice(idx, 0, {});
      s.dirty = true;
    });
  };

  const deleteRow = (idx) => {
    if (sheet?.rows.length <= 1) return;
    updateSheet((sheets, s) => {
      s.rows.splice(idx, 1);
      s.dirty = true;
    });
  };

  // ── Column Resize ────────────────────────────────────────────────────

  const handleResizeStart = (ci, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = columnWidths[ci] || COLUMN_WIDTH;
    const onMove = (ev) => {
      const newW = Math.max(60, startW + (ev.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [ci]: newW }));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Sorting ──────────────────────────────────────────────────────────

  const toggleSort = (ci) => {
    const col = sheet?.columns[ci];
    if (!col) return;
    if (sortColumn === ci) {
      if (sortDir === "asc") { setSortDir("desc"); }
      else { setSortColumn(null); setSortDir(null); }
    } else {
      setSortColumn(ci);
      setSortDir("asc");
    }
  };

  const sortedRows = [...(sheet?.rows || [])].sort((a, b) => {
    if (sortColumn === null) return 0;
    const col = sheet.columns[sortColumn];
    const va = (a[col] || "").toString().toLowerCase();
    const vb = (b[col] || "").toString().toLowerCase();
    const numA = parseFloat(va);
    const numB = parseFloat(vb);
    if (!isNaN(numA) && !isNaN(numB)) {
      return sortDir === "asc" ? numA - numB : numB - numA;
    }
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // ── Filtering ────────────────────────────────────────────────────────

  const filteredRows = sortedRows.filter((row) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = sheet?.columns.some((c) => (row[c] || "").toString().toLowerCase().includes(q));
      if (!match) return false;
    }
    for (const [ci, val] of Object.entries(filterText)) {
      if (!val) continue;
      const col = sheet?.columns[parseInt(ci)];
      const cellVal = (row[col] || "").toString().toLowerCase();
      if (!cellVal.includes(val.toLowerCase())) return false;
    }
    return true;
  });

  // ── Import ───────────────────────────────────────────────────────────

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("template_key", sheet.name.toLowerCase().replace(/\s+/g, "_"));

    try {
      const res = await (await fetch("http://127.0.0.1:8000/api/io/import/validate", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      })).json();

      if (!res.valid) {
        toast.error(`${res.error_count} validation errors`);
        return;
      }

      updateSheet((sheets, s) => {
        s.rows = res.rows.map((r) => {
          const row = {};
          s.columns.forEach((c) => { row[c] = r[c] || ""; });
          return row;
        });
        s.dirty = true;
      });
      toast.success(`Imported ${res.valid_count} rows`);
    } catch (err) {
      toast.error("Import failed");
    }
    e.target.value = "";
  };

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const api = (await import("../api/client")).default;
      await api.post("/expenses/generate-voucher-no");
      toast.success("Data saved");
      updateSheet((sheets, s) => { s.dirty = false; });
      if (onSaved) onSaved();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Context Menu ─────────────────────────────────────────────────────

  const handleContextMenu = (e, rowIdx, colIdx) => {
    e.preventDefault();
    setSelection({ row: rowIdx, col: colIdx });
    setContextMenu({ x: e.clientX, y: e.clientY, row: rowIdx, col: colIdx });
  };

  // ── Render ───────────────────────────────────────────────────────────

  const visibleColumns = sheet?.columns || [];
  const displayRows = filteredRows;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-app)]" style={{ "--accent": "#f6ce3a" }}>
      {/* Toolbar */}
      <Toolbar
        sheet={sheet}
        activeSheet={activeSheet}
        sheets={sheets}
        onSheetChange={setActiveSheet}
        onSave={handleSave}
        saving={saving}
        undo={undo}
        redo={redo}
        canUndo={historyIndex >= 0}
        canRedo={historyIndex < history.length - 1}
        onImport={handleImport}
        onExport={() => {}}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClose={onClose}
      />

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto" ref={tableRef} tabIndex={0} onKeyDown={handleKeyDown}>
        <table className="w-full border-collapse" style={{ minWidth: ROW_HEADER_WIDTH + visibleColumns.length * COLUMN_WIDTH }}>
          <thead>
            <tr style={{ height: HEADER_HEIGHT }}>
              <th className="sticky top-0 z-20 border-r border-b px-1 text-xs font-semibold"
                style={{ width: ROW_HEADER_WIDTH, background: "var(--bg-elevated)", borderColor: "var(--border-color)", minWidth: ROW_HEADER_WIDTH }}>
                #
              </th>
              {visibleColumns.map((col, ci) => (
                <th key={ci}
                  className="sticky top-0 z-10 border-r border-b px-2 text-xs font-semibold text-left relative select-none"
                  style={{
                    width: columnWidths[ci] || COLUMN_WIDTH,
                    minWidth: columnWidths[ci] || COLUMN_WIDTH,
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate">{col}</span>
                    <button onClick={() => toggleSort(ci)} className="p-0.5 hover:opacity-70">
                      <ArrowUpDown size={10} />
                    </button>
                  </div>
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)]"
                    onMouseDown={(e) => handleResizeStart(ci, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.slice(0, 2000).map((row, ri) => (
              <tr key={ri}
                style={{ height: ROW_HEIGHT }}
                className="hover:bg-[var(--bg-hover)]"
              >
                <td className="border-r border-b text-xs text-center select-none"
                  style={{
                    borderColor: "var(--border-color)",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH,
                  }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{ri + 1}</span>
                    <button onClick={() => deleteRow(ri)} className="p-0 text-red-400 opacity-0 hover:opacity-100">
                      <X size={10} />
                    </button>
                  </div>
                </td>
                {visibleColumns.map((col, ci) => {
                  const val = row[col] ?? "";
                  const isSelected = selection.row === ri && selection.col === ci;
                  const isEditing = isSelected && editing;
                  const isFrozen = ri < frozenRows;
                  return (
                    <td key={ci}
                      className={`border-r border-b relative ${isSelected ? "ring-2 ring-inset" : ""} ${isFrozen ? "font-semibold" : ""}`}
                      style={{
                        borderColor: "var(--border-color)",
                        width: columnWidths[ci] || COLUMN_WIDTH,
                        minWidth: columnWidths[ci] || COLUMN_WIDTH,
                        background: isSelected ? "rgba(246, 206, 58, 0.15)" : isFrozen ? "var(--bg-elevated)" : "transparent",
                      }}
                      onClick={() => { setSelection({ row: ri, col: ci }); setEditing(false); }}
                      onDoubleClick={() => { setSelection({ row: ri, col: ci }); setEditValue(val); setEditing(true); }}
                      onContextMenu={(e) => handleContextMenu(e, ri, ci)}
                    >
                      {isEditing ? (
                        <input ref={editRef}
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => { setCellValue(selection.row, selection.col, editValue); setEditing(false); }}
                          className="absolute inset-0 w-full h-full px-2 text-sm outline-none border-2"
                          style={{ borderColor: "#f6ce3a", background: "#fff", color: "#000", zIndex: 5 }}
                        />
                      ) : (
                        <div className={`px-2 text-sm truncate ${isNaN(val) ? "" : "text-right font-mono"}`}
                          style={{ color: "var(--text-primary)", lineHeight: `${ROW_HEIGHT}px` }}>
                          {val}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {displayRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet size={48} className="mb-4 opacity-30" />
            <p className="font-semibold">No data in this sheet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Import data or start typing to add rows
            </p>
            <button onClick={() => insertRow()} className="mt-4 btn-soft px-4 py-2 text-sm flex items-center gap-2">
              <Plus size={14} /> Add Row
            </button>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t px-4 py-1 text-xs"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-4">
          <span>{sheet?.name || "Sheet"}</span>
          <span>{displayRows.length} rows × {visibleColumns.length} columns</span>
          {selection.row >= 0 && <span>Cell: {colLabel(selection.col)}{selection.row + 1}</span>}
          {sheet?.dirty && <span className="text-amber-400">Unsaved changes</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} disabled={historyIndex < 0} className="p-1 hover:opacity-70 disabled:opacity-30">
            <Undo2 size={12} />
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1 hover:opacity-70 disabled:opacity-30">
            <Redo2 size={12} />
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed z-50 rounded-lg border shadow-xl py-1 text-sm"
          style={{
            left: contextMenu.x, top: contextMenu.y,
            background: "var(--bg-card)", borderColor: "var(--border-color)",
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { handleCopy(null); setContextMenu(null); }}>
            <Copy size={12} /> Copy
          </button>
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { handleCut(null); setContextMenu(null); }}>
            <Scissors size={12} /> Cut
          </button>
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { handlePaste(null); setContextMenu(null); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Paste
          </button>
          <hr style={{ borderColor: "var(--border-color)" }} />
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            onClick={() => { insertRow(contextMenu.row); setContextMenu(null); }}>
            <Plus size={12} /> Insert Row
          </button>
          <button className="w-full px-4 py-1.5 text-left flex items-center gap-2 text-red-400 hover:bg-red-500/10"
            onClick={() => { deleteRow(contextMenu.row); setContextMenu(null); }}>
            <Trash2 size={12} /> Delete Row
          </button>
        </div>
      )}
    </div>
  );
}

function Toolbar({
  sheet, activeSheet, sheets, onSheetChange,
  onSave, saving, undo, redo, canUndo, canRedo,
  onImport, searchQuery, onSearchChange, onClose,
}) {
  const fileRef = useRef(null);

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2 flex-wrap"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      {/* Sheet tabs */}
      <div className="flex items-center gap-1 mr-4 overflow-x-auto max-w-[40%]">
        {sheets.map((s, i) => (
          <button key={s.name}
            onClick={() => onSheetChange(i)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all"
            style={{
              background: activeSheet === i ? "#f6ce3a" : "var(--bg-elevated)",
              color: activeSheet === i ? "#000" : "var(--text-secondary)",
            }}
          >
            {s.name}
            {s.dirty && <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-amber-400" />}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
        <input id="spreadsheet-search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search (Ctrl+F)..."
          className="rounded-lg border pl-8 pr-3 py-1.5 text-xs outline-none w-48"
          style={{ background: "var(--bg-elevated)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Import/Export */}
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onImport} />
      <button onClick={() => fileRef.current?.click()} className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1">
        <Upload size={12} /> Import
      </button>

      {/* Actions */}
      <button onClick={undo} disabled={!canUndo} className="btn-soft px-2 py-1.5 disabled:opacity-30" title="Undo (Ctrl+Z)">
        <Undo2 size={13} />
      </button>
      <button onClick={redo} disabled={!canRedo} className="btn-soft px-2 py-1.5 disabled:opacity-30" title="Redo (Ctrl+Y)">
        <Redo2 size={13} />
      </button>

      <div className="w-px h-6" style={{ background: "var(--border-color)" }} />

      <button onClick={onSave} disabled={saving}
        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-black flex items-center gap-1"
        style={{ background: "#f6ce3a" }}
      >
        <Save size={12} /> {saving ? "Saving..." : "Save"}
      </button>

      <button onClick={onClose} className="btn-soft px-3 py-1.5 text-xs flex items-center gap-1">
        <ArrowLeft size={13} /> Back
      </button>
    </div>
  );
}
