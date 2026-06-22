import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";
import api from "../api/client";
import { posApi } from "../api/pos";
import { useAuth } from "../contexts/AuthContext";
import { formatPKR } from "../utils/currency";

function BarcodePrintWindow({ barcodeDataUrl, productName, barcodeNumber, price, onClose }) {
  useEffect(() => {
    const w = window.open("", "BarcodeLabel", "width=300,height=300");
    if (!w) { onClose(); return; }
    w.document.write(`
      <!DOCTYPE html><html><head><title>Print Label</title>
      <style>
        @media print {
          body * { visibility: hidden; }
          #barcode-label, #barcode-label * { visibility: visible; }
          #barcode-label { position: absolute; top: 0; left: 0; width: 5cm; padding: 4px; text-align: center; font-family: monospace; font-size: 10px; }
        }
        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        #barcode-label { width: 5cm; padding: 4px; text-align: center; font-family: monospace; font-size: 10px; }
        img { max-width: 100%; height: auto; }
      </style></head><body>
      <div id="barcode-label">
        <h2 style="margin:0;font-size:12px;">EYERFLOW</h2>
        <p style="margin:4px 0;">${productName}</p>
        <img src="${barcodeDataUrl}" alt="barcode" />
        <p style="margin:4px 0;">${barcodeNumber}</p>
        <p style="margin:4px 0;">Price: ${price}</p>
      </div>
      <script>window.onload=function(){window.print();window.close();};<\/script>
    </body></html>`);
    w.document.close();
  }, []);

  return null;
}

function CartRow({ item, onQtyChange, onRemove, currency }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.qty));
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    const n = parseInt(qty, 10);
    if (!isNaN(n) && n > 0 && n <= item.stock) {
      onQtyChange(item.item_id, n);
    } else {
      setQty(String(item.qty));
    }
    setEditing(false);
  };

  return (
    <tr className="border-t text-sm" style={{ borderColor: "var(--border-color)" }}>
      <td className="py-1.5 px-2 truncate max-w-[120px]">{item.item_name}</td>
      <td className="py-1.5 px-2 text-center">
        {editing ? (
          <input
            ref={inputRef}
            className="input w-14 text-center text-xs py-0.5"
            type="number"
            min="1"
            max={item.stock}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setQty(String(item.qty)); setEditing(false); } }}
          />
        ) : (
          <button className="cursor-pointer hover:text-teal-400" onClick={() => { setQty(String(item.qty)); setEditing(true); }}>
            {item.qty}
          </button>
        )}
      </td>
      <td className="py-1.5 px-2 text-right">{formatPKR(item.unit_price)}</td>
      <td className="py-1.5 px-2 text-right">{formatPKR(item.qty * item.unit_price)}</td>
      <td className="py-1.5 px-2 text-center">
        <button className="icon-btn icon-btn-danger" onClick={() => onRemove(item.item_id)} title="Remove">
          <i className="ti ti-x" style={{ fontSize: "14px" }} />
        </button>
      </td>
    </tr>
  );
}

export default function POSPage() {
  const { role } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [scanValue, setScanValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [barcodePrint, setBarcodePrint] = useState(null);
  const [scanIndicator, setScanIndicator] = useState({ status: "", message: "" });

  const scanRef = useRef(null);
  const searchRef = useRef(null);
  const cashRef = useRef(null);
  const discountTimeout = useRef(null);

  // ── Load data ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [p, c, bn] = await Promise.all([
        api.get("/products"),
        api.get("/customers"),
        posApi.nextBillNumber(),
      ]);
      setProducts(Array.isArray(p.data) ? p.data : []);
      setCustomers(Array.isArray(c.data) ? c.data : []);
      setBillNumber(bn.bill_number);
    } catch { /* backend not ready */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-focus scanner input on mount & re-focus on any click outside inputs
  useEffect(() => {
    const refocus = (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.closest("button"))) return;
      if (scanRef.current) scanRef.current.focus();
    };
    document.addEventListener("click", refocus, true);
    if (scanRef.current) scanRef.current.focus();
    return () => document.removeEventListener("click", refocus, true);
  }, []);

  useEffect(() => {
    if (scanIndicator.status === "success" || scanIndicator.status === "error") {
      const t = setTimeout(() => setScanIndicator({ status: "", message: "" }), 3500);
      return () => clearTimeout(t);
    }
  }, [scanIndicator]);

  // ── Barcode Scanner ────────────────────────────────────────────────────
  const handleScan = useCallback(async (e) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanIndicator({ status: "scanning", message: `Scanning ${code}...` });
    try {
      const item = await posApi.lookupByBarcode(code);
      addToCart(item);
      setScanValue("");
      setScanIndicator({ status: "success", message: `${item.name} added ✓` });
      if (scanRef.current) scanRef.current.focus();
    } catch {
      setScanIndicator({ status: "error", message: "Item not found" });
      setScanValue("");
      setTimeout(() => {
        if (scanRef.current) scanRef.current.focus();
      }, 100);
    }
  }, [scanValue]);

  // ── Manual Search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (discountTimeout.current) clearTimeout(discountTimeout.current);
    if (searchQuery.length < 1) { setSearchResults([]); setShowSearchDropdown(false); return; }
    discountTimeout.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const results = products.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
      ).slice(0, 10);
      setSearchResults(results);
      setShowSearchDropdown(results.length > 0);
    }, 200);
    return () => { if (discountTimeout.current) clearTimeout(discountTimeout.current); };
  }, [searchQuery, products]);

  const selectSearchItem = (product) => {
    addToCart(product);
    setSearchQuery("");
    setShowSearchDropdown(false);
    if (searchRef.current) searchRef.current.focus();
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item_id === product.id);
      if (existing) {
        const newQty = existing.qty + 1;
        if (newQty > (product.stock || 999)) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return prev.map((i) => i.item_id === product.id ? { ...i, qty: newQty } : i);
      }
      if ((product.stock || 0) < 1) {
        toast.error(`${product.name} is out of stock`);
        return prev;
      }
      return [...prev, {
        item_id: product.id,
        item_name: product.name,
        qty: 1,
        unit_price: product.selling_price,
        stock: product.stock,
      }];
    });
  };

  const quickItems = useMemo(() => products.slice(0, 12), [products]);

  // ── Cart Operations ────────────────────────────────────────────────────
  const updateQty = (itemId, newQty) => {
    setCart((prev) => {
      const item = prev.find((i) => i.item_id === itemId);
      if (!item) return prev;
      if (newQty > (item.stock || 999)) {
        toast.error(`Only ${item.stock} in stock`);
        return prev;
      }
      return prev.map((i) => i.item_id === itemId ? { ...i, qty: newQty } : i);
    });
  };

  const removeItem = (itemId) => {
    setCart((prev) => prev.filter((i) => i.item_id !== itemId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm("Clear entire cart?")) {
      setCart([]);
      setDiscountValue("");
      setCashReceived("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setPaymentMethod("cash");
    }
  };

  // ── Calculations ──────────────────────────────────────────────────────
  const subtotal = useMemo(() => cart.reduce((sum, i) => sum + i.qty * i.unit_price, 0), [cart]);

  // Map item_id → cost_price for quick lookup
  const costPriceMap = useMemo(() => {
    const map = {};
    products.forEach((p) => { map[p.id] = p.cost_price || 0; });
    return map;
  }, [products]);

  const totalCost = useMemo(
    () => cart.reduce((sum, i) => sum + i.qty * (costPriceMap[i.item_id] || 0), 0),
    [cart, costPriceMap]
  );

  const discount = useMemo(() => {
    if (!discountValue) return 0;
    const val = parseFloat(discountValue) || 0;
    if (discountType === "amount") return Math.min(val, subtotal);
    return Math.min(subtotal * (val / 100), subtotal);
  }, [discountValue, discountType, subtotal]);

  const total = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);

  // Discount validation: discount cannot exceed total cost
  const discountExceedsCost = discount > totalCost;
  const maxAllowedDiscount = totalCost;

  const cashNum = parseFloat(cashReceived) || 0;
  const change = total > 0 ? Math.max(0, cashNum - total) : 0;

  // ── Customer Search ────────────────────────────────────────────────────
  useEffect(() => {
    if (customerSearch.length < 1) { setCustomerResults([]); setShowCustomerDropdown(false); return; }
    const q = customerSearch.toLowerCase();
    setCustomerResults(customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5));
    setShowCustomerDropdown(true);
  }, [customerSearch, customers]);

  // ── Print Receipt Helper ───────────────────────────────────────────────
  const printBrowserReceipt = (saleData) => {
    const w = window.open("", "Receipt", "width=400,height=600");
    if (!w) return;
    const itemRows = saleData.items.map((i) =>
      `<tr><td>${i.item_name} x${i.qty}</td><td style="text-align:right">${formatPKR(i.total_price)}</td></tr>`
    ).join("");
    w.document.write(`
      <!DOCTYPE html><html><head><title>Receipt</title>
      <style>
        @media print { body * { visibility: hidden; } #receipt, #receipt * { visibility: visible; } #receipt { position: absolute; top: 0; left: 0; width: 8cm; padding: 8px; } }
        body { font-family: monospace; font-size: 12px; margin: 0; padding: 8px; }
        #receipt { width: 8cm; margin: 0 auto; }
        h2, h3 { text-align: center; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 4px; }
        .line { border-top: 1px dashed #000; }
        .total { font-weight: bold; font-size: 14px; }
        .center { text-align: center; }
      </style></head><body>
      <div id="receipt">
        <h2>EYERFLOW OPTICAL</h2>
        <p class="center">Your Shop Address Here</p>
        <p class="center">Phone: 0300-0000000</p>
        <hr/>
        <p>Date: ${saleData.date} | Bill#: ${saleData.bill_number}</p>
        ${saleData.customer_name ? `<p>Customer: ${saleData.customer_name}</p>` : ""}
        <hr/>
        <table>${itemRows}</table>
        <hr/>
        <p style="text-align:right">Subtotal: ${formatPKR(saleData.subtotal)}</p>
        ${saleData.discount > 0 ? `<p style="text-align:right">Discount: -${formatPKR(saleData.discount)}</p>` : ""}
        <p class="total" style="text-align:right">TOTAL: ${formatPKR(saleData.total)}</p>
        ${saleData.payment_method === "cash" ? `<p style="text-align:right">Cash: ${formatPKR(saleData.cash_received)}</p><p style="text-align:right">Change: ${formatPKR(saleData.change)}</p>` : ""}
        <hr/>
        <p class="center">Thank you for visiting!</p>
        <p class="center">Come again :)</p>
      </div>
      <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
    w.document.close();
  };

  // ── Save & Print ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    if (paymentMethod === "cash" && total > 0 && cashNum < total) {
      toast.error("Cash received is less than total");
      if (cashRef.current) cashRef.current.focus();
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          item_id: i.item_id,
          item_name: i.item_name,
          qty: i.qty,
          unit_price: i.unit_price,
          total_price: i.qty * i.unit_price,
        })),
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        cash_received: paymentMethod === "cash" ? cashNum : null,
        change_amount: paymentMethod === "cash" ? change : null,
        customer_id: selectedCustomer?.id || null,
      };

      const result = await posApi.createSale(payload);

      const saleData = {
        date: new Date().toLocaleDateString("en-PK"),
        bill_number: result.bill_number,
        customer_name: selectedCustomer?.name || null,
        items: payload.items,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        cash_received: cashNum,
        change,
      };

      // Try thermal printer first
      if (window.electronAPI?.printReceipt) {
        const pr = await window.electronAPI.printReceipt(saleData);
        if (!pr.success) {
          printBrowserReceipt(saleData);
        }
      } else {
        printBrowserReceipt(saleData);
      }

      toast.success(`Sale #${result.bill_number} saved!`);
      // Reset
      setCart([]);
      setDiscountValue("");
      setCashReceived("");
      setSelectedCustomer(null);
      setCustomerSearch("");
      setPaymentMethod("cash");
      setBillNumber(result.bill_number);
      // Reload products for updated stock
      const p = await api.get("/products");
      setProducts(Array.isArray(p.data) ? p.data : []);
      if (scanRef.current) scanRef.current.focus();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save sale");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (scanRef.current) scanRef.current.focus();
      }
      if (e.key === "F8") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        if (showSearchDropdown) { setShowSearchDropdown(false); return; }
        if (showCustomerDropdown) { setShowCustomerDropdown(false); return; }
        clearCart();
      }
      if (e.key === "Delete" && selectedRow !== null) {
        const idx = selectedRow;
        if (cart[idx]) { removeItem(cart[idx].item_id); setSelectedRow(null); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart, selectedRow, showSearchDropdown, showCustomerDropdown]);

  const today = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <h2 className="text-lg font-semibold">EYERFLOW POS</h2>
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>{today}</span>
          <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>Bill# {billNumber}</span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* ─── Left Panel ─── */}
        <div className="flex flex-col gap-3 w-[45%] min-w-0">
          {/* Scanner Input */}
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <i className="ti ti-barcode absolute left-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: "14px", color: "var(--text-secondary)" }} />
              <input
                ref={scanRef}
                className="input pl-8 text-sm"
                placeholder="Scan or type barcode..."
                value={scanValue}
                onChange={(e) => { setScanValue(e.target.value); if (scanIndicator.status) setScanIndicator({ status: "", message: "" }); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.form?.requestSubmit(); }}
                autoComplete="off"
              />
              {scanIndicator.status && (
                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${scanIndicator.status === "success" ? "text-green-700 bg-green-100" : scanIndicator.status === "error" ? "text-red-700 bg-red-100" : "text-blue-700 bg-blue-100"}`}>
                  {scanIndicator.message}
                </span>
              )}
            </div>
            <button type="submit" className="btn-primary text-xs px-3" title="Lookup barcode (Enter)">
              <i className="ti ti-search" style={{ fontSize: "14px" }} />
            </button>
          </form>

          {/* Manual Search */}
          <div className="relative">
            <input
              ref={searchRef}
              className="input text-sm"
              placeholder="OR search item by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && searchResults.length > 0) selectSearchItem(searchResults[0]); }}
            />
            {showSearchDropdown && (
              <div
                className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border shadow-lg"
                style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
              >
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] transition-colors"
                    onClick={() => selectSearchItem(p)}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 ml-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {formatPKR(p.selling_price)} {p.stock !== undefined ? `(${p.stock})` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Items Grid */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Quick Items</p>
            <div className="grid grid-cols-3 gap-1.5">
              {quickItems.map((p) => (
                <button
                  key={p.id}
                  className="rounded-lg border px-2 py-2 text-left text-xs transition-all hover:border-teal-500 hover:bg-teal-500/5"
                  style={{ borderColor: "var(--border-color)" }}
                  onClick={() => addToCart(p)}
                  disabled={p.stock === 0}
                >
                  <p className="font-medium truncate">{p.name}</p>
                  <p style={{ color: "var(--text-secondary)" }}>{formatPKR(p.selling_price)}</p>
                  {p.stock !== undefined && (
                    <p className={`text-[10px] ${p.stock <= 5 ? "text-rose-400" : ""}`}>
                      {p.stock === 0 ? "Out of stock" : `Stock: ${p.stock}`}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Search */}
          <div className="relative">
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Customer (optional)</p>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border-color)" }}>
                <i className="ti ti-user text-teal-400" style={{ fontSize: "14px" }} />
                <span className="flex-1">{selectedCustomer.name}</span>
                <button className="text-xs hover:text-rose-400" onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  className="input text-sm"
                  placeholder="Search customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {showCustomerDropdown && customerResults.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border shadow-lg"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
                  >
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] transition-colors"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); setShowCustomerDropdown(false); }}
                      >
                        {c.name} {c.phone ? `— ${c.phone}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── Right Panel (Cart) ─── */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto rounded-lg border" style={{ borderColor: "var(--border-color)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-elevated)" }}>
                  <th className="py-2 px-2 text-left font-semibold">Item</th>
                  <th className="py-2 px-2 text-center font-semibold w-16">Qty</th>
                  <th className="py-2 px-2 text-right font-semibold">Price</th>
                  <th className="py-2 px-2 text-right font-semibold">Total</th>
                  <th className="py-2 px-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                      Scan or search items to add to cart
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => (
                    <CartRow
                      key={item.item_id}
                      item={item}
                      onQtyChange={updateQty}
                      onRemove={removeItem}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
              <span>{formatPKR(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-2">
              <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>Discount</span>
              <input
                className="input w-20 text-xs py-0.5"
                type="number"
                min="0"
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
              <button
                className="text-xs px-2 py-0.5 rounded border transition-colors"
                style={{ borderColor: "var(--border-color)" }}
                onClick={() => setDiscountType(discountType === "amount" ? "percent" : "amount")}
              >
                {discountType === "amount" ? "PKR" : "%"}
              </button>
              {discount > 0 && <span className="text-xs text-rose-400">-{formatPKR(discount)}</span>}
            </div>

            {discountExceedsCost && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                <i className="ti ti-alert-triangle mr-1" />
                Discount exceeds cost value. Max allowed: <strong>{formatPKR(maxAllowedDiscount)}</strong>
              </div>
            )}

            <div className="flex justify-between font-bold text-base pt-1" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span>TOTAL</span>
              <span style={{ color: "#008080" }}>{formatPKR(total)}</span>
            </div>

            {/* Payment */}
            <div className="flex gap-2 mt-2">
              {["cash", "card", "other"].map((method) => (
                <button
                  key={method}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === method ? "ring-2 ring-teal-500 border-teal-500" : ""
                  }`}
                  style={{
                    borderColor: paymentMethod === method ? "#008080" : "var(--border-color)",
                    background: paymentMethod === method ? "color-mix(in srgb, #008080 10%, var(--bg-card))" : "transparent",
                  }}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method === "cash" ? "💵 Cash" : method === "card" ? "💳 Card" : "Other"}
                </button>
              ))}
            </div>

            {paymentMethod === "cash" && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>Cash Received</span>
                <input
                  ref={cashRef}
                  className="input flex-1 text-xs py-0.5"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
              </div>
            )}

            {paymentMethod === "cash" && cashNum > 0 && total > 0 && (
              <div className="flex justify-between text-xs">
                <span>Change</span>
                <span className={change >= 0 ? "" : "text-rose-400"}>{formatPKR(change)}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                className="btn-primary flex-1 text-sm"
                disabled={submitting || cart.length === 0 || discountExceedsCost}
                onClick={handleSave}
                title="Save & Print (F8)"
              >
                {submitting ? "Saving..." : "🖨 Print & Save"}
              </button>
              <button
                className="btn-soft text-sm"
                onClick={clearCart}
                disabled={cart.length === 0}
                title="Clear Cart (Escape)"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode print overlay */}
      {barcodePrint && (
        <BarcodePrintWindow
          barcodeDataUrl={barcodePrint.dataUrl}
          productName={barcodePrint.productName}
          barcodeNumber={barcodePrint.barcodeNumber}
          price={barcodePrint.price}
          onClose={() => setBarcodePrint(null)}
        />
      )}
    </div>
  );
}
