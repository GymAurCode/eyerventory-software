import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/client";
import { useSpreadsheet } from "../contexts/SpreadsheetContext";

const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const SHEETS = [
  { key: "items",    label: "Items" },
  { key: "suppliers", label: "Suppliers" },
  { key: "shops",    label: "Shops" },
  { key: "stockIn",  label: "Stock In" },
  { key: "stockOut", label: "Stock Out" },
];

const COLUMNS = {
  items: [
    { key: "name",          label: "Item Name",       type: "text",   required: true },
    { key: "unit",          label: "Unit",            type: "text",   required: true },
    { key: "category",      label: "Category",        type: "text"   },
    { key: "openingStock",  label: "Opening Stock",   type: "number", required: true },
    { key: "minAlertLevel", label: "Min Alert Level", type: "number", required: true },
  ],
  suppliers: [
    { key: "name",  label: "Name",  type: "text", required: true },
    { key: "phone", label: "Phone", type: "text", required: true },
    { key: "city",  label: "City",  type: "text"  },
  ],
  shops: [
    { key: "name",    label: "Shop Name", type: "text", required: true },
    { key: "contact", label: "Contact",   type: "text"  },
    { key: "area",    label: "Area",      type: "text"  },
  ],
  stockIn: [
    { key: "date",      label: "Date",      type: "date",     required: true },
    { key: "itemName",  label: "Item Name", type: "dropdown",  required: true, sourceSheet: "items", sourceCol: "name" },
    { key: "quantity",  label: "Quantity",  type: "number",    required: true },
    { key: "rate",      label: "Rate",      type: "number",    required: true },
    { key: "supplier",  label: "Supplier",  type: "dropdown",  sourceSheet: "suppliers", sourceCol: "name" },
    { key: "note",      label: "Note",      type: "text"      },
  ],
  stockOut: [
    { key: "date",      label: "Date",      type: "date",     required: true },
    { key: "itemName",  label: "Item Name", type: "dropdown",  required: true, sourceSheet: "items", sourceCol: "name" },
    { key: "quantity",  label: "Quantity",  type: "number",    required: true },
    { key: "rate",      label: "Rate",      type: "number",    required: true },
    { key: "shop",      label: "Shop",      type: "dropdown",  sourceSheet: "shops", sourceCol: "name" },
    { key: "note",      label: "Note",      type: "text"      },
  ],
};

function getDropdownOptions(sheetKey, col) {
  if (col.type !== "dropdown" || !col.sourceSheet) return [];
  const src = window.__SPREADSHEET_DATA__?.[col.sourceSheet];
  if (!src) return [];
  const names = src.map((r) => r[col.sourceCol]).filter(Boolean);
  return [...new Set(names)];
}

// ── Cell Editor ──
function CellEditor({ value, type, options, onChange, onBlur, onKeyDown, inputRef }) {
  if (type === "dropdown") {
    return (
      <select
        ref={inputRef}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="spreadsheet-select"
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: "inherit",
          fontFamily: "inherit",
          color: "inherit",
          padding: "0 4px",
          cursor: "pointer",
          height: "100%",
        }}
      >
        <option value="" />
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      ref={inputRef}
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(type === "number" ? e.target.value : e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      autoFocus
      style={{
        width: "100%",
        border: "none",
        outline: "none",
        background: "transparent",
        fontSize: "inherit",
        fontFamily: "inherit",
        color: "inherit",
        padding: "0 4px",
        height: "100%",
      }}
    />
  );
}

// ── Spreadsheet Grid ──
function SheetGrid({ sheetKey, rows, cols, onAddRow, onDeleteRow, onCellChange }) {
  const { updateCell } = useSpreadsheet();
  const [editing, setEditing] = useState(null); // { rowId, colKey }
  const [editValue, setEditValue] = useState("");
  const [addCount, setAddCount] = useState(1);
  const inputRef = useRef(null);
  const gridRef = useRef(null);
  const rowRefs = useRef({});

  // Expose data for dropdown lookups
  useEffect(() => {
    if (!window.__SPREADSHEET_DATA__) window.__SPREADSHEET_DATA__ = {};
    const { data } = useSpreadsheet.getInternal ? useSpreadsheet.getInternal() : { data: {} };
  }, []);

  // Keep global data reference for dropdowns
  const { data } = useSpreadsheet();
  useEffect(() => {
    window.__SPREADSHEET_DATA__ = data;
  }, [data]);

  const focusCell = useCallback((rowId, colKey) => {
    setEditing({ rowId, colKey });
    const row = rows.find((r) => r.id === rowId);
    setEditValue(row ? (row[colKey] ?? "") : "");
  }, [rows]);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const { rowId, colKey } = editing;
    const col = cols.find((c) => c.key === colKey);
    const finalVal = col?.type === "number" ? (editValue === "" ? "" : Number(editValue)) : editValue;
    onCellChange(rowId, colKey, finalVal);
    updateCell(sheetKey, rowId, colKey, finalVal);
    setEditing(null);
    setEditValue("");
  }, [editing, editValue, cols, onCellChange, updateCell, sheetKey]);

  const handleKeyDown = useCallback((e) => {
    if (!editing) return;
    const { rowId, colKey } = editing;
    const colIdx = cols.findIndex((c) => c.key === colKey);

    if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      const nextIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextIdx >= 0 && nextIdx < cols.length) {
        focusCell(rowId, cols[nextIdx].key);
      } else if (!e.shiftKey && nextIdx >= cols.length) {
        // Tab at end of row -> move to next row
        const rowIdx = rows.findIndex((r) => r.id === rowId);
        if (rowIdx < rows.length - 1) {
          focusCell(rows[rowIdx + 1].id, cols[0].key);
        }
      } else if (e.shiftKey && nextIdx < 0) {
        const rowIdx = rows.findIndex((r) => r.id === rowId);
        if (rowIdx > 0) {
          focusCell(rows[rowIdx - 1].id, cols[cols.length - 1].key);
        }
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      const rowIdx = rows.findIndex((r) => r.id === rowId);
      if (rowIdx < rows.length - 1) {
        focusCell(rows[rowIdx + 1].id, colKey);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      commitEdit();
    }
  }, [editing, cols, rows, commitEdit, focusCell]);

  const handleCellClick = useCallback((rowId, colKey) => {
    // Don't re-enter if already editing this cell
    if (editing?.rowId === rowId && editing?.colKey === colKey) return;
    commitEdit();
    focusCell(rowId, colKey);
  }, [editing, commitEdit, focusCell]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // Auto-add rows when scrolling near bottom
  const handleScroll = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      // near bottom, auto-add a row
    }
  }, []);

  return (
    <div className="spreadsheet-wrapper" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        ref={gridRef}
        className="spreadsheet-grid"
        style={{
          flex: 1,
          overflow: "auto",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
        }}
        onScroll={handleScroll}
      >
        <table className="spreadsheet-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: "12px" }}>
          {/* ── HEADER ── */}
          <thead>
            <tr style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--bg-elevated)" }}>
              <th
                className="spreadsheet-row-header"
                style={{
                  width: 36,
                  minWidth: 36,
                  padding: "6px 2px",
                  textAlign: "center",
                  borderRight: "1px solid var(--border-color)",
                  borderBottom: "2px solid var(--border-color)",
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  background: "var(--bg-elevated)",
                }}
              >
                #
              </th>
              {cols.map((col, i) => (
                <th
                  key={col.key}
                  style={{
                    padding: "4px 6px",
                    textAlign: "left",
                    borderRight: "1px solid var(--border-color)",
                    borderBottom: "2px solid var(--border-color)",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  <span style={{ color: "var(--text-secondary)", marginRight: 4, fontFamily: "monospace" }}>
                    {COL_LETTERS[i]}
                  </span>
                  {col.label}
                </th>
              ))}
              <th
                style={{
                  width: 28,
                  minWidth: 28,
                  padding: "4px 2px",
                  borderBottom: "2px solid var(--border-color)",
                  textAlign: "center",
                }}
              />
            </tr>
          </thead>

          {/* ── BODY ── */}
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={cols.length + 2}
                  style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                  }}
                >
                  No rows yet. Click "+ Add Row" below to start.
                </td>
              </tr>
            )}
            {rows.map((row, rowIdx) => {
              const isEditing = editing?.rowId === row.id;
              return (
                <tr
                  key={row.id}
                  ref={(el) => { rowRefs.current[row.id] = el; }}
                  style={{
                    background: rowIdx % 2 === 0 ? "var(--bg-card)" : "color-mix(in srgb, var(--bg-card) 97%, var(--accent))",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 8%, var(--bg-card))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rowIdx % 2 === 0 ? "var(--bg-card)" : "color-mix(in srgb, var(--bg-card) 97%, var(--accent))";
                  }}
                >
                  <td
                    className="spreadsheet-row-num"
                    style={{
                      width: 36,
                      minWidth: 36,
                      padding: "2px",
                      textAlign: "center",
                      borderRight: "1px solid var(--border-color)",
                      borderBottom: "1px solid var(--border-color)",
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      fontFamily: "monospace",
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
                      background: "inherit",
                    }}
                  >
                    {rowIdx + 1}
                  </td>

                  {cols.map((col, colIdx) => {
                    const isActiveEdit = isEditing && editing.colKey === col.key;
                    const dropdownOptions = col.type === "dropdown"
                      ? getDropdownOptions(sheetKey, col)
                      : [];

                    return (
                      <td
                        key={col.key}
                        onClick={() => handleCellClick(row.id, col.key)}
                        style={{
                          padding: isActiveEdit ? 0 : "2px 6px",
                          borderRight: "1px solid var(--border-color)",
                          borderBottom: "1px solid var(--border-color)",
                          cursor: "pointer",
                          height: 28,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          background: isActiveEdit
                            ? "var(--bg-card)"
                            : "transparent",
                          outline: isActiveEdit
                            ? "2px solid #008080"
                            : "none",
                          outlineOffset: isActiveEdit ? -1 : 0,
                          color: col.type === "number" && (row[col.key] === "" || row[col.key] == null)
                            ? "var(--text-secondary)"
                            : "var(--text-primary)",
                        }}
                      >
                        {isActiveEdit ? (
                          <CellEditor
                            value={editValue}
                            type={col.type}
                            options={dropdownOptions}
                            onChange={setEditValue}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            inputRef={inputRef}
                          />
                        ) : (
                          <span>
                            {col.type === "date" && row[col.key]
                              ? row[col.key]
                              : col.type === "number" && row[col.key] !== "" && row[col.key] != null
                                ? Number(row[col.key]).toLocaleString()
                                : row[col.key] || <span style={{ color: "var(--text-secondary)", opacity: 0.4 }}>&mdash;</span>}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td
                    style={{
                      width: 28,
                      minWidth: 28,
                      padding: "2px",
                      borderBottom: "1px solid var(--border-color)",
                      textAlign: "center",
                    }}
                  >
                    <button
                      onClick={() => onDeleteRow(row.id)}
                      title="Delete row"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-secondary)",
                        opacity: 0,
                        fontSize: "13px",
                        padding: 0,
                        lineHeight: 1,
                        transition: "opacity 0.15s",
                      }}
                      className="delete-row-btn"
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Add Row Controls ── */}
      <div
        className="spreadsheet-footer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderTop: "1px solid var(--border-color)",
          background: "var(--bg-elevated)",
          borderRadius: "0 0 8px 8px",
        }}
      >
        <button
          onClick={onAddRow}
          className="btn-soft"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: "13px" }} />
          Add Row
        </button>

        <button
          onClick={() => {
            for (let i = 0; i < Math.max(1, addCount); i++) onAddRow();
          }}
          className="btn-soft"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: "13px" }} />
          Add {addCount > 1 ? `${addCount} Rows` : "Row"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>x</span>
          <input
            type="number"
            min={1}
            max={100}
            value={addCount}
            onChange={(e) => setAddCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            style={{
              width: 40,
              padding: "2px 4px",
              fontSize: "11px",
              border: "1px solid var(--border-color)",
              borderRadius: 4,
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              textAlign: "center",
              outline: "none",
            }}
          />
        </div>

        <span style={{ fontSize: "10px", color: "var(--text-secondary)", marginLeft: "auto" }}>
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <style>{`
        .spreadsheet-table td:hover .delete-row-btn {
          opacity: 0.6 !important;
        }
        .spreadsheet-select option {
          background: var(--bg-card);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}

// ── Confirm Modal ──
function ConfirmModal({ open, summary, onConfirm, onCancel, saving }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-2xl"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Update System</h3>
        <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
          The following changes will be pushed to the warehouse system:
        </p>

        <div className="space-y-2 mb-4">
          {summary.items > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" }}>
              <span style={{ color: "var(--text-primary)" }}>Items</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{summary.items}</span>
            </div>
          )}
          {summary.suppliers > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" }}>
              <span style={{ color: "var(--text-primary)" }}>Suppliers</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{summary.suppliers}</span>
            </div>
          )}
          {summary.shops > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" }}>
              <span style={{ color: "var(--text-primary)" }}>Shops</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{summary.shops}</span>
            </div>
          )}
          {summary.stockIn > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" }}>
              <span style={{ color: "var(--text-primary)" }}>Stock In entries</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{summary.stockIn}</span>
            </div>
          )}
          {summary.stockOut > 0 && (
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--bg-elevated))" }}>
              <span style={{ color: "var(--text-primary)" }}>Stock Out entries</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{summary.stockOut}</span>
            </div>
          )}
        </div>

        {(summary.errors || []).length > 0 && (
          <div className="mb-3 p-2 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {(summary.errors || []).map((err, i) => <p key={i}>{err}</p>)}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn-soft" style={{ fontSize: "11px", padding: "6px 16px" }} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary"
            style={{ fontSize: "11px", padding: "6px 16px" }}
            disabled={saving || (summary.errors || []).length > 0}
          >
            {saving ? "Updating..." : "Confirm Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function SpreadsheetPage() {
  const { data, addRow, deleteRow, updateCell } = useSpreadsheet();
  const [activeTab, setActiveTab] = useState("items");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [summary, setSummary] = useState({ items: 0, suppliers: 0, shops: 0, stockIn: 0, stockOut: 0, errors: [] });

  const activeSheet = SHEETS.find((s) => s.key === activeTab);
  const activeCols = COLUMNS[activeTab];
  const activeRows = data[activeTab] || [];

  // ── Validation ──
  const validate = useCallback(() => {
    const errors = [];
    const sheets = ["items", "suppliers", "shops", "stockIn", "stockOut"];

    for (const sheetKey of sheets) {
      const rows = data[sheetKey] || [];
      const cols = COLUMNS[sheetKey];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        for (const col of cols) {
          if (col.required) {
            const val = row[col.key];
            if (val === "" || val === null || val === undefined) {
              errors.push(`${sheetKey} row ${i + 1}: "${col.label}" is required`);
            }
          }
          if (col.type === "number" && row[col.key] !== "" && row[col.key] != null) {
            const num = Number(row[col.key]);
            if (isNaN(num) || num < 0) {
              errors.push(`${sheetKey} row ${i + 1}: "${col.label}" must be a positive number`);
            }
          }
        }
      }
    }

    // Check stock going below zero (Stock Out > available stock for items)
    const itemStockMap = {};
    for (const item of (data.items || [])) {
      const opening = Number(item.openingStock) || 0;
      const name = item.name;
      if (!name) continue;
      let stockIn = 0;
      let stockOut = 0;
      for (const si of (data.stockIn || [])) {
        if (si.itemName === name) stockIn += Number(si.quantity) || 0;
      }
      for (const so of (data.stockOut || [])) {
        if (so.itemName === name) stockOut += Number(so.quantity) || 0;
      }
      itemStockMap[name] = opening + stockIn - stockOut;
      if (itemStockMap[name] < 0) {
        errors.push(`"${name}" stock would go below zero (available: ${opening + stockIn}, trying to stock out: ${stockOut})`);
      }
    }

    return errors;
  }, [data]);

  // ── Build Summary ──
  const buildSummary = useCallback(() => {
    const errors = validate();
    return {
      items: (data.items || []).filter((r) => r.name?.trim()).length,
      suppliers: (data.suppliers || []).filter((r) => r.name?.trim()).length,
      shops: (data.shops || []).filter((r) => r.name?.trim()).length,
      stockIn: (data.stockIn || []).filter((r) => r.itemName?.trim()).length,
      stockOut: (data.stockOut || []).filter((r) => r.itemName?.trim()).length,
      errors,
    };
  }, [data, validate]);

  const handleUpdateClick = useCallback(() => {
    const s = buildSummary();
    setSummary(s);
    if (s.items === 0 && s.suppliers === 0 && s.shops === 0 && s.stockIn === 0 && s.stockOut === 0) {
      setStatusMsg({ type: "info", text: "No data to update." });
      return;
    }
    setShowConfirm(true);
  }, [buildSummary]);

  const handleConfirmUpdate = useCallback(async () => {
    setSaving(true);
    setStatusMsg(null);
    const results = { items: 0, suppliers: 0, shops: 0, stockIn: 0, stockOut: 0 };

    try {
      // Step 1: Get existing products/suppliers/customers from backend for matching
      const [existingProducts, existingSuppliers, existingCustomers] = await Promise.all([
        api.get("/products").catch(() => ({ data: [] })),
        api.get("/suppliers").catch(() => ({ data: [] })),
        api.get("/customers").catch(() => ({ data: [] })),
      ]);

      const prodList = Array.isArray(existingProducts.data) ? existingProducts.data : [];
      const suppList = Array.isArray(existingSuppliers.data) ? existingSuppliers.data : [];
      const custList = Array.isArray(existingCustomers.data) ? existingCustomers.data : [];

      // Build name -> id maps
      const productMap = {};
      for (const p of prodList) productMap[p.name.toLowerCase()] = p.id;
      const supplierMap = {};
      for (const s of suppList) supplierMap[s.name.toLowerCase()] = s.id;
      const customerMap = {};
      for (const c of custList) customerMap[c.name.toLowerCase()] = c.id;

      // Step 2: Upsert items
      for (const item of (data.items || [])) {
        if (!item.name?.trim()) continue;
        const name = item.name.trim();
        const key = name.toLowerCase();
        const stock = Number(item.openingStock) || 0;
        const threshold = Number(item.minAlertLevel) || 10;

        if (productMap[key]) {
          // Update
          await api.put(`/products/${productMap[key]}`, {
            name,
            unit: item.unit?.trim() || null,
            category: item.category?.trim() || null,
            stock,
            low_stock_threshold: threshold,
            cost_price: 1,
            selling_price: 0,
          }).catch(() => {});
          results.items++;
        } else {
          // Create
          const res = await api.post("/products", {
            name,
            unit: item.unit?.trim() || null,
            category: item.category?.trim() || null,
            stock,
            low_stock_threshold: threshold,
            cost_price: 1,
            selling_price: 0,
          }).catch(() => null);
          if (res?.data?.id) {
            productMap[key] = res.data.id;
          }
          results.items++;
        }
      }

      // Step 3: Upsert suppliers
      for (const supp of (data.suppliers || [])) {
        if (!supp.name?.trim()) continue;
        const name = supp.name.trim();
        const key = name.toLowerCase();

        if (supplierMap[key]) {
          await api.put(`/suppliers/${supplierMap[key]}`, {
            name,
            phone: supp.phone?.trim() || null,
            address: supp.city?.trim() || null,
            opening_balance: 0,
          }).catch(() => {});
          results.suppliers++;
        } else {
          const res = await api.post("/suppliers", {
            name,
            phone: supp.phone?.trim() || null,
            address: supp.city?.trim() || null,
            opening_balance: 0,
          }).catch(() => null);
          if (res?.data?.id) supplierMap[key] = res.data.id;
          results.suppliers++;
        }
      }

      // Step 4: Upsert shops (as customers)
      for (const shop of (data.shops || [])) {
        if (!shop.name?.trim()) continue;
        const name = shop.name.trim();
        const key = name.toLowerCase();

        if (customerMap[key]) {
          await api.put(`/customers/${customerMap[key]}`, {
            name,
            phone: shop.contact?.trim() || null,
            address: shop.area?.trim() || null,
            opening_balance: 0,
          }).catch(() => {});
          results.shops++;
        } else {
          const res = await api.post("/customers", {
            name,
            phone: shop.contact?.trim() || null,
            address: shop.area?.trim() || null,
            opening_balance: 0,
          }).catch(() => null);
          if (res?.data?.id) customerMap[key] = res.data.id;
          results.shops++;
        }
      }

      // Step 5: Create stock in entries (purchases)
      for (const entry of (data.stockIn || [])) {
        if (!entry.itemName?.trim()) continue;
        const itemKey = entry.itemName.trim().toLowerCase();
        const productId = productMap[itemKey];
        if (!productId) continue;

        const supplierKey = (entry.supplier || "").trim().toLowerCase();
        const supplierId = supplierMap[supplierKey] || null;

        const qty = Number(entry.quantity) || 1;
        const rate = Number(entry.rate) || 0;
        const date = entry.date || new Date().toISOString().slice(0, 10);

        try {
          await api.post("/purchases", {
            supplier_id: supplierId || 1,
            invoice_number: `SPR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            purchase_date: date,
            discount: 0,
            tax: 0,
            payment_type: "CASH",
            notes: entry.note?.trim() || null,
            items: [{ product_id: productId, quantity: qty, purchase_price: rate }],
          });
          results.stockIn++;
        } catch { /* skip failed entries */ }
      }

      // Step 6: Create stock out entries (sales)
      for (const entry of (data.stockOut || [])) {
        if (!entry.itemName?.trim()) continue;
        const itemKey = entry.itemName.trim().toLowerCase();
        const productId = productMap[itemKey];
        if (!productId) continue;

        const shopKey = (entry.shop || "").trim().toLowerCase();
        const customerId = customerMap[shopKey] || null;

        const qty = Number(entry.quantity) || 1;
        const rate = Number(entry.rate) || 0;

        try {
          await api.post("/sales", {
            product_id: productId,
            customer_id: customerId,
            quantity: qty,
            selling_price: rate,
            payment_type: "CASH",
          });
          results.stockOut++;
        } catch { /* skip */ }
      }

      setShowConfirm(false);
      setStatusMsg({
        type: "success",
        text: `${results.items} items, ${results.suppliers} suppliers, ${results.shops} shops, ${results.stockIn} stock-in, ${results.stockOut} stock-out updated successfully.`,
      });
    } catch (err) {
      setStatusMsg({ type: "error", text: "Update failed. Check console for details." });
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [data]);

  // ── Tab badge count ──
  const tabCount = (sheetKey) => {
    const r = data[sheetKey] || [];
    return r.filter((row) => {
      if (sheetKey === "items") return row.name?.trim();
      if (sheetKey === "suppliers") return row.name?.trim();
      if (sheetKey === "shops") return row.name?.trim();
      if (sheetKey === "stockIn") return row.itemName?.trim();
      if (sheetKey === "stockOut") return row.itemName?.trim();
      return false;
    }).length;
  };

  // Strip .0 from numbers for cleaner display
  const formatDisplayVal = (val) => {
    if (val === "" || val == null) return "";
    if (typeof val === "number") return Number.isInteger(val) ? val : val;
    return val;
  };

  return (
    <div className="flex flex-col" style={{ height: "100%", overflow: "hidden" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-3"
        style={{ background: "var(--bg-card)", border: "0.5px solid var(--border-color)" }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Spreadsheet Editor</h2>
          <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            Edit all your data in one place — Click "Update System" to push changes
          </p>
        </div>
        <button
          onClick={handleUpdateClick}
          className="btn-primary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 20px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <i className="ti ti-cloud-upload" style={{ fontSize: "14px" }} />
          Update System
        </button>
      </div>

      {/* ── Status Message ── */}
      {statusMsg && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg mb-3 text-xs"
          style={{
            background: statusMsg.type === "success"
              ? "rgba(34,197,94,0.1)"
              : statusMsg.type === "error"
                ? "rgba(239,68,68,0.1)"
                : "rgba(96,165,250,0.1)",
            color: statusMsg.type === "success"
              ? "#22c55e"
              : statusMsg.type === "error"
                ? "#ef4444"
                : "#60a5fa",
          }}
        >
          <i className={`ti ${statusMsg.type === "success" ? "ti-check-circle" : statusMsg.type === "error" ? "ti-alert-circle" : "ti-info-circle"}`} style={{ fontSize: "14px" }} />
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="ml-auto"
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, fontSize: "14px", opacity: 0.6 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Tab Bar ── */}
      <div
        className="flex rounded-xl mb-3 overflow-hidden"
        style={{ border: "0.5px solid var(--border-color)", background: "var(--bg-card)" }}
      >
        {SHEETS.map((sheet) => {
          const active = activeTab === sheet.key;
          const count = tabCount(sheet.key);
          return (
            <button
              key={sheet.key}
              onClick={() => setActiveTab(sheet.key)}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: "11px",
                fontWeight: 600,
                border: "none",
                borderRight: "1px solid var(--border-color)",
                cursor: "pointer",
                background: active ? "var(--accent)" : "transparent",
                color: active ? "#fff" : "var(--text-secondary)",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {sheet.label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: "9px",
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: active ? "rgba(255,255,255,0.2)" : "color-mix(in srgb, var(--accent) 20%, var(--bg-elevated))",
                    color: active ? "#fff" : "var(--accent)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Sheet Grid ── */}
      <div className="flex-1" style={{ overflow: "hidden" }}>
        <SheetGrid
          key={activeTab}
          sheetKey={activeTab}
          rows={activeRows}
          cols={activeCols}
          onAddRow={() => addRow(activeTab)}
          onDeleteRow={(rowId) => deleteRow(activeTab, rowId)}
          onCellChange={(rowId, colKey, value) => updateCell(activeTab, rowId, colKey, value)}
        />
      </div>

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        open={showConfirm}
        summary={summary}
        saving={saving}
        onConfirm={handleConfirmUpdate}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
