import { useEffect, useRef, useState } from "react";
import { Calendar, Search, X } from "lucide-react";
import api from "../../api/client";

export function DateRangePicker({ value, onChange }) {
  const presets = [
    { label: "Today", days: 0 },
    { label: "This Week", days: 7 },
    { label: "This Month", days: 30 },
    { label: "This Year", days: 365 },
    { label: "Custom", days: -1 },
  ];

  const today = new Date();
  const toStr = (d) => d.toISOString().slice(0, 10);

  const handlePreset = (days) => {
    if (days === -1) return;
    const end = toStr(today);
    const start = days === 0 ? end : toStr(new Date(today.getTime() - days * 86400000));
    onChange({ start, end });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => handlePreset(p.days)}
          className="px-2.5 py-1 text-[10px] font-medium rounded-lg transition-all"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "0.5px solid var(--border-color)",
          }}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-1">
        <input
          type="date"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="input py-1 text-[10px] w-28"
        />
        <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>to</span>
        <input
          type="date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="input py-1 text-[10px] w-28"
        />
      </div>
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, placeholder, className }) {
  return (
    <div className={className}>
      {label && <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--text-secondary)" }}>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input py-1.5 text-xs w-full">
        <option value="">{placeholder || `All ${label || ""}`}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function WarehouseFilter({ value, onChange, multi }) {
  const [warehouses, setWarehouses] = useState([]);
  useEffect(() => {
    api.get("/warehouses").then((r) => setWarehouses(r.data || [])).catch(() => {});
  }, []);

  if (multi) {
    return (
      <div className="relative">
        <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--text-secondary)" }}>Warehouse</label>
        <select
          multiple
          value={value || []}
          onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
          className="input py-1 text-xs w-full h-20"
        >
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
    );
  }

  return (
    <FilterSelect label="Warehouse" value={value} onChange={onChange}
      options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
      placeholder="All Warehouses"
    />
  );
}

export function SalesmanFilter({ value, onChange }) {
  const [salesmen, setSalesmen] = useState([]);
  useEffect(() => {
    api.get("/employees").then((r) => {
      const list = r.data || [];
      setSalesmen(list.filter((e) => e.role === "salesman" || e.designation?.toLowerCase().includes("sales")));
    }).catch(() => {});
  }, []);

  return (
    <FilterSelect label="Salesman" value={value} onChange={onChange}
      options={salesmen.map((s) => ({ value: s.id, label: s.name }))}
      placeholder="All Salesmen"
    />
  );
}

export function ShopFilter({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [shops, setShops] = useState([]);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get("/shops").then((r) => setShops(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(shops.filter((s) => s.name?.toLowerCase().includes(q)).slice(0, 10));
  }, [query, shops]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--text-secondary)" }}>Shop</label>
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
        <input
          value={value ? shops.find((s) => s.id === Number(value))?.name || query : query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Search shop..."
          className="input py-1.5 text-xs w-full pl-7"
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X size={11} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg max-h-48 overflow-auto"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {results.map((s) => (
            <button key={s.id} onClick={() => { onChange(s.id); setQuery(s.name); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)]">
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductFilter({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const q = query.toLowerCase();
    setResults(products.filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 10));
  }, [query, products]);

  useEffect(() => {
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="text-[10px] font-medium mb-0.5 block" style={{ color: "var(--text-secondary)" }}>Product</label>
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
        <input
          value={value ? products.find((p) => p.id === Number(value))?.name || query : query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Search product..."
          className="input py-1.5 text-xs w-full pl-7"
        />
        {value && (
          <button onClick={() => { onChange(""); setQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X size={11} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg max-h-48 overflow-auto"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {results.map((p) => (
            <button key={p.id} onClick={() => { onChange(p.id); setQuery(p.name); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-hover)]">
              {p.name} {p.sku ? <span className="opacity-50">({p.sku})</span> : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusFilter({ value, onChange, statuses }) {
  return (
    <FilterSelect label="Status" value={value} onChange={onChange}
      options={(statuses || ["paid", "partial", "unpaid", "active", "inactive"]).map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
      placeholder="All Statuses"
    />
  );
}

export function AgingFilter({ value, onChange }) {
  return (
    <FilterSelect label="Aging" value={value} onChange={onChange}
      options={[
        { value: "0-30", label: "0-30 days" },
        { value: "31-60", label: "31-60 days" },
        { value: "61-90", label: "61-90 days" },
        { value: "90+", label: "90+ days" },
      ]}
      placeholder="All Aging"
    />
  );
}

export function MovementTypeFilter({ value, onChange }) {
  return (
    <FilterSelect label="Movement Type" value={value} onChange={onChange}
      options={[
        { value: "stock_in", label: "Stock In" },
        { value: "stock_out", label: "Stock Out" },
        { value: "transfer_in", label: "Transfer In" },
        { value: "transfer_out", label: "Transfer Out" },
        { value: "damage", label: "Damage" },
        { value: "adjustment", label: "Adjustment" },
        { value: "return_shop", label: "Return (Shop)" },
        { value: "return_salesman", label: "Return (Salesman)" },
      ]}
      placeholder="All Types"
    />
  );
}

export function CategoryFilter({ value, onChange }) {
  const categories = ["Frames", "Lenses", "Contact Lenses", "Sunglasses", "Accessories", "Solutions"];
  return (
    <FilterSelect label="Category" value={value} onChange={onChange}
      options={categories.map((c) => ({ value: c, label: c }))}
      placeholder="All Categories"
    />
  );
}

export function ReturnTypeFilter({ value, onChange }) {
  return (
    <FilterSelect label="Return Type" value={value} onChange={onChange}
      options={[
        { value: "shop", label: "Shop Return" },
        { value: "salesman", label: "Salesman Return" },
      ]}
      placeholder="All Returns"
    />
  );
}
