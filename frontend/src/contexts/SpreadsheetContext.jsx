import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "eyerflow_spreadsheet_data";

const INITIAL_DATA = {
  items: [],
  suppliers: [],
  shops: [],
  stockIn: [],
  stockOut: [],
};

let idCounter = Date.now();
function genId() {
  return `row_${++idCounter}`;
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure all keys exist
      for (const k of Object.keys(INITIAL_DATA)) {
        if (!Array.isArray(parsed[k])) parsed[k] = [];
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(INITIAL_DATA));
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

const SpreadsheetContext = createContext(null);

export function SpreadsheetProvider({ children }) {
  const [data, setData] = useState(loadFromStorage);

  useEffect(() => { saveToStorage(data); }, [data]);

  const addRow = useCallback((sheet) => {
    const template = {
      items: { name: "", unit: "", category: "", openingStock: "", minAlertLevel: "" },
      suppliers: { name: "", phone: "", city: "" },
      shops: { name: "", contact: "", area: "" },
      stockIn: { date: new Date().toISOString().slice(0, 10), itemName: "", quantity: "", rate: "", supplier: "", note: "" },
      stockOut: { date: new Date().toISOString().slice(0, 10), itemName: "", quantity: "", rate: "", shop: "", note: "" },
    };
    const row = { id: genId(), ...template[sheet] };
    setData((prev) => ({ ...prev, [sheet]: [...prev[sheet], row] }));
    return row;
  }, []);

  const deleteRow = useCallback((sheet, rowId) => {
    setData((prev) => ({ ...prev, [sheet]: prev[sheet].filter((r) => r.id !== rowId) }));
  }, []);

  const updateCell = useCallback((sheet, rowId, colKey, value) => {
    setData((prev) => ({
      ...prev,
      [sheet]: prev[sheet].map((r) => (r.id === rowId ? { ...r, [colKey]: value } : r)),
    }));
  }, []);

  const updateRow = useCallback((sheet, rowId, updates) => {
    setData((prev) => ({
      ...prev,
      [sheet]: prev[sheet].map((r) => (r.id === rowId ? { ...r, ...updates } : r)),
    }));
  }, []);

  const setSheetData = useCallback((sheet, rows) => {
    setData((prev) => ({ ...prev, [sheet]: rows }));
  }, []);

  const resetAll = useCallback(() => {
    setData(JSON.parse(JSON.stringify(INITIAL_DATA)));
  }, []);

  const exportJson = useCallback(() => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  const importJson = useCallback((jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      setData(parsed);
      return true;
    } catch { return false; }
  }, []);

  return (
    <SpreadsheetContext.Provider
      value={{
        data,
        addRow,
        deleteRow,
        updateCell,
        updateRow,
        setSheetData,
        resetAll,
        exportJson,
        importJson,
      }}
    >
      {children}
    </SpreadsheetContext.Provider>
  );
}

export function useSpreadsheet() {
  const ctx = useContext(SpreadsheetContext);
  if (!ctx) throw new Error("useSpreadsheet must be used within SpreadsheetProvider");
  return ctx;
}
