import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "sonner";
import api from "../api/client";
import { posApi } from "../api/pos";
import AddProductDialog from "../components/AddProductDialog";
import { ActionButtons, ConfirmDialog, DataTable, EmptyState, LoadingSkeleton, Modal, PageHeader, StatCard } from "../components/UI";
import { useAuth } from "../contexts/AuthContext";
import { useShortcuts } from "../contexts/ShortcutContext";
import { formatPKR } from "../utils/currency";
import { printRecord } from "../utils/print";

// ── Barcode print helpers ──────────────────────────────────────────────────────
async function printSingleBarcode(itemId, itemName, price, barcodeNumber) {
  let src = "";
  try {
    const blob = await posApi.getBarcodeImage(itemId);
    src = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    toast.error("Failed to load barcode image");
    return;
  }
  const printWindow = window.open("", "_blank", "width=400,height=300");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html><html><head>
    <style>
      @page { size: 5cm 3cm; margin: 2mm; }
      body { margin: 0; padding: 0; font-family: monospace; display: flex; justify-content: center; align-items: center; }
      .label { width: 5cm; text-align: center; padding: 2mm; border: 0.5px solid #ccc; }
      .shop-name { font-size: 8px; font-weight: bold; }
      .item-name { font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .barcode-img { width: 100%; height: auto; }
      .barcode-num { font-size: 7px; letter-spacing: 1px; }
      .price { font-size: 10px; font-weight: bold; }
    </style></head><body>
    <div class="label">
      <div class="shop-name">EYERFLOW OPTICAL</div>
      <div class="item-name">${itemName}</div>
      <img class="barcode-img" src="${src}" alt="barcode" />
      <div class="barcode-num">${barcodeNumber}</div>
      <div class="price">Rs. ${price}</div>
    </div>
    <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
    </body></html>
  `);
  printWindow.document.close();
}

async function printBulkBarcodes(selectedItems) {
  const itemsWithSrc = await Promise.all(selectedItems.map(async (item) => {
    let src = "";
    try {
      const blob = await posApi.getBarcodeImage(item.id);
      src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // leave src empty — skip image
    }
    return { ...item, src };
  }));

  const labelsHTML = itemsWithSrc.map((item) => `
    <div class="label">
      <div class="shop-name">EYERFLOW OPTICAL</div>
      <div class="item-name">${item.name}</div>
      ${item.src ? `<img src="${item.src}" alt="barcode" />` : ""}
      <div class="barcode-num">${item.barcode_number || ""}</div>
      <div class="price">Rs. ${item.selling_price}</div>
    </div>
  `).join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html><html><head>
    <style>
      @page { margin: 5mm; }
      body { margin: 0; font-family: monospace; }
      .labels-grid { display: grid; grid-template-columns: repeat(4, 5cm); gap: 2mm; }
      .label { width: 5cm; text-align: center; padding: 2mm; border: 0.5px solid #ccc; page-break-inside: avoid; }
      .shop-name { font-size: 8px; font-weight: bold; }
      .item-name { font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      img { width: 100%; height: auto; }
      .barcode-num { font-size: 7px; letter-spacing: 1px; }
      .price { font-size: 10px; font-weight: bold; }
    </style></head><body>
    <div class="labels-grid">${labelsHTML}</div>
    <script>
      const images = document.querySelectorAll('img');
      let loaded = 0;
      images.forEach(img => { img.onload = img.onerror = () => { loaded++; if (loaded === images.length) { window.print(); window.onafterprint = () => window.close(); } }; });
      if (images.length === 0) { window.print(); window.onafterprint = () => window.close(); }
    <\/script>
    </body></html>
  `);
  printWindow.document.close();
}

// ── Bulk import nudge tooltip — points at the Import Products button ──────────
function ImportNudgeTooltip({ onDismiss }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border px-4 py-3"
      style={{
        borderColor: "#6366F1",
        background: "color-mix(in srgb, #6366F1 8%, var(--bg-card))",
        animation: "nudge-pulse 2s ease-in-out 3",
      }}
    >
      {/* Arrow pointing up-right toward the header button */}
      <span
        className="mt-0.5 shrink-0 text-lg"
        style={{ animation: "bounce-up 1s ease-in-out infinite" }}
      >
        ☝️
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "#6366F1" }}>
          Adding multiple products?
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Use the <strong>Import Products</strong> button above to add many products at once via Excel.
        </p>
      </div>
      <button
        className="shrink-0 rounded px-1.5 py-0.5 text-xs transition-opacity hover:opacity-60"
        style={{ color: "var(--text-secondary)" }}
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ── Enterprise Product Detail Dashboard ────────────────────────────────────────

function ProductDetailDashboard({ product, barcodeImgUrl, onClose, onEdit, onDelete, onAddStock, onBarcodeRegen, onBarcodeDownload, onPrintLabel }) {
  const [activeSection, setActiveSection] = useState("overview");
  const [favorited, setFavorited] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const stockVal = (Number(product.stock) || 0) * (Number(product.cost_price) || 0);
  const sellVal = (Number(product.stock) || 0) * (Number(product.selling_price) || 0);
  const margin = Number(product.cost_price) ? ((Number(product.selling_price) - Number(product.cost_price)) / Number(product.cost_price)) * 100 : 0;
  const profitPerUnit = (Number(product.selling_price) || 0) - (Number(product.cost_price) || 0);
  const potentialProfit = (Number(product.stock) || 0) * profitPerUnit;
  const stockMeta = getStockMeta(Number(product.stock || 0));

  useEffect(() => {
    if (!product?.id) return;
    setTimelineLoading(true);
    const entries = [
      { type: "created", label: "Product Created", desc: "Product was added to the system", icon: "ti-circle-plus", color: "#6366f1" },
    ];
    if (product.updated_at) {
      entries.push({ type: "updated", label: "Last Updated", desc: `Updated ${new Date(product.updated_at).toLocaleString()}`, icon: "ti-refresh", color: "#f59e0b" });
    }
    if (product.stock > 0) {
      entries.push({ type: "stock", label: "Stock Available", desc: `${product.stock} units in inventory`, icon: "ti-package", color: "#22c55e" });
    }
    setTimeline(entries);
    setTimelineLoading(false);
  }, [product?.id]);

  const statusColor = Number(product.stock) === 0 ? "#ef4444" : Number(product.stock) <= 10 ? "#f59e0b" : "#22c55e";
  const statusLabel = Number(product.stock) === 0 ? "Out of Stock" : Number(product.stock) <= 10 ? "Low Stock" : "In Stock";

  const sections = [
    { id: "overview", label: "Overview", icon: "ti-dashboard" },
    { id: "details", label: "Details", icon: "ti-info-circle" },
    { id: "financial", label: "Financial", icon: "ti-currency-dollar" },
    { id: "barcode", label: "Barcode", icon: "ti-barcode" },
    { id: "timeline", label: "Timeline", icon: "ti-timeline" },
  ];

  const SectionNav = () => (
    <div className="flex gap-1 overflow-x-auto pb-1 mb-4 sticky -top-0 z-10" style={{ background: "var(--bg-card)" }}>
      {sections.map((s) => (
        <button key={s.id} onClick={() => setActiveSection(s.id)}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: activeSection === s.id ? "var(--accent)" : "var(--bg-elevated)",
            color: activeSection === s.id ? "#fff" : "var(--text-secondary)",
            border: "0.5px solid var(--border-color)",
          }}>
          <i className={`ti ${s.icon}`} style={{ fontSize: "14px" }} />
          {s.label}
        </button>
      ))}
    </div>
  );

  const StatCardSm = ({ icon, label, value, trend, color }) => (
    <div className="relative overflow-hidden rounded-xl p-3" style={{
      background: "color-mix(in srgb, var(--bg-elevated) 95%, transparent)",
      border: "0.5px solid var(--border-color)",
      backdropFilter: "blur(8px)",
    }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</p>
          <p className="text-lg font-bold mt-0.5" style={{ color: color || "var(--text-primary)" }}>{value}</p>
        </div>
        <div className="rounded-lg p-2" style={{ background: `color-mix(in srgb, ${color || "#6366f1"} 15%, transparent)` }}>
          <i className={`ti ${icon}`} style={{ color: color || "#6366f1", fontSize: "18px" }} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <span className="text-[10px] font-medium" style={{ color: trend >= 0 ? "#22c55e" : "#ef4444" }}>
            <i className={`ti ${trend >= 0 ? "ti-trending-up" : "ti-trending-down"}`} style={{ fontSize: "10px" }} /> {Math.abs(trend)}%
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>vs avg</span>
        </div>
      )}
    </div>
  );

  const GlassCard = ({ children, className = "" }) => (
    <div className={`rounded-xl p-4 ${className}`} style={{
      background: "color-mix(in srgb, var(--bg-elevated) 97%, transparent)",
      border: "0.5px solid var(--border-color)",
      backdropFilter: "blur(12px)",
    }}>
      {children}
    </div>
  );

  const FieldRow = ({ label, value, col }) => (
    <div className={col || "col-span-1"}>
      <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
    </div>
  );

  const TimelineIcon = ({ icon, color }) => (
    <div className="rounded-full p-1.5" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)` }}>
      <i className={`ti ${icon}`} style={{ color, fontSize: "14px" }} />
    </div>
  );

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto px-1" style={{ scrollbarWidth: "thin" }}>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pb-2" style={{ background: "var(--bg-card)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {product.image_data ? (
              <div className="shrink-0 rounded-xl overflow-hidden" style={{ width: 64, height: 64, border: "0.5px solid var(--border-color)" }}>
                <img src={product.image_data} alt={product.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="shrink-0 rounded-xl flex items-center justify-center" style={{ width: 64, height: 64, background: "var(--bg-elevated)", border: "0.5px solid var(--border-color)" }}>
                <i className="ti ti-box" style={{ color: "var(--text-secondary)", fontSize: "24px" }} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate" style={{ color: "var(--text-primary)" }}>{product.name}</h2>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: `color-mix(in srgb, ${statusColor} 18%, transparent)`, color: statusColor }}>
                  {statusLabel}
                </span>
                <button onClick={() => setFavorited(!favorited)} className="text-sm" style={{ color: favorited ? "#f59e0b" : "var(--text-secondary)" }}>
                  <i className={`ti ${favorited ? "ti-star-filled" : "ti-star"}`} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span><i className="ti ti-hash mr-1" />{product.id}</span>
                {product.sku && <span><i className="ti ti-tag mr-1" />{product.sku}</span>}
                {product.category && <span><i className="ti ti-folder mr-1" />{product.category}</span>}
                {product.created_at && <span><i className="ti ti-calendar mr-1" />Created {new Date(product.created_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onEdit} className="btn-soft px-2.5 py-1.5 text-xs flex items-center gap-1" title="Edit"><i className="ti ti-pencil" /> Edit</button>
            <button onClick={onDelete} className="btn-soft px-2.5 py-1.5 text-xs flex items-center gap-1" style={{ color: "#ef4444" }} title="Delete"><i className="ti ti-trash" /> Delete</button>
            <button onClick={onPrintLabel} className="btn-soft px-2.5 py-1.5 text-xs" title="Print Label"><i className="ti ti-printer" /></button>
            <button onClick={onBarcodeDownload} className="btn-soft px-2.5 py-1.5 text-xs" title="Download Barcode"><i className="ti ti-download" /></button>
            <button onClick={onClose} className="btn-soft px-2.5 py-1.5 text-xs" title="Close"><i className="ti ti-x" /></button>
          </div>
        </div>
      </div>

      {/* ── Section Navigation ── */}
      <SectionNav />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Overview
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <StatCardSm icon="ti-package" label="Current Stock" value={product.stock} color="#6366f1" />
            <StatCardSm icon="ti-currency-dollar" label="Stock Value (Cost)" value={formatPKR(stockVal)} color="#22c55e" />
            <StatCardSm icon="ti-currency-dollar" label="Stock Value (Sell)" value={formatPKR(sellVal)} color="#06b6d4" />
            <StatCardSm icon="ti-percentage" label="Profit Margin" value={`${margin.toFixed(1)}%`} trend={margin} color="#f59e0b" />
            <StatCardSm icon="ti-coins" label="Potential Profit" value={formatPKR(potentialProfit)} color="#ec4899" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Product Information</h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Name" value={product.name} />
                <FieldRow label="SKU" value={product.sku || "—"} />
                <FieldRow label="Category" value={product.category || "—"} />
                <FieldRow label="Stock" value={product.stock} />
                <FieldRow label="Cost Price" value={formatPKR(product.cost_price)} />
                <FieldRow label="Selling Price" value={formatPKR(product.selling_price)} />
                {product.created_at && <FieldRow label="Created" value={new Date(product.created_at).toLocaleDateString()} />}
                {product.updated_at && <FieldRow label="Updated" value={new Date(product.updated_at).toLocaleDateString()} />}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Financial Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Cost Price (Unit)</span>
                  <span className="text-sm font-semibold">{formatPKR(product.cost_price)}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Selling Price (Unit)</span>
                  <span className="text-sm font-semibold">{formatPKR(product.selling_price)}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Profit Per Unit</span>
                  <span className="text-sm font-semibold" style={{ color: profitPerUnit >= 0 ? "#22c55e" : "#ef4444" }}>{formatPKR(profitPerUnit)}</span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: "0.5px solid var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Margin</span>
                  <span className="text-sm font-semibold" style={{ color: margin >= 0 ? "#22c55e" : "#ef4444" }}>{margin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Inventory Value (Cost)</span>
                  <span className="text-sm font-bold">{formatPKR(stockVal)}</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Details
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "details" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>General Information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldRow label="Product ID" value={`#${product.id}`} />
              <FieldRow label="Name" value={product.name} />
              <FieldRow label="SKU" value={product.sku || "—"} />
              <FieldRow label="Category" value={product.category || "—"} />
              <FieldRow label="Barcode" value={product.barcode_number || "—"} />
              <FieldRow label="Description" value={product.description || "—"} col="col-span-2" />
            </div>
          </GlassCard>
          <GlassCard>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Inventory Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <FieldRow label="Current Stock" value={product.stock} />
              <FieldRow label="Stock Status" value={stockMeta.label || "Normal"} />
              <FieldRow label="Cost Price" value={formatPKR(product.cost_price)} />
              <FieldRow label="Selling Price" value={formatPKR(product.selling_price)} />
              <FieldRow label="Stock Value" value={formatPKR(stockVal)} />
              <FieldRow label="Total Value (Sell)" value={formatPKR(sellVal)} />
            </div>
          </GlassCard>
          {product.image_data && (
            <GlassCard className="lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Product Image</h3>
              <div className="flex justify-center">
                <img src={product.image_data} alt={product.name} className="max-h-64 rounded-lg object-contain" style={{ maxWidth: "400px" }} />
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Financial
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "financial" && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <StatCardSm icon="ti-currency-dollar" label="Cost Price" value={formatPKR(product.cost_price)} color="#6366f1" />
            <StatCardSm icon="ti-currency-dollar" label="Selling Price" value={formatPKR(product.selling_price)} color="#22c55e" />
            <StatCardSm icon="ti-coins" label="Profit / Unit" value={formatPKR(profitPerUnit)} color={profitPerUnit >= 0 ? "#22c55e" : "#ef4444"} />
            <StatCardSm icon="ti-percentage" label="Margin" value={`${margin.toFixed(1)}%`} color="#f59e0b" />
          </div>
          <GlassCard>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>P&L Breakdown</h3>
            <div className="space-y-3">
              {[
                { label: "Revenue if Sold", value: sellVal, color: "#22c55e" },
                { label: "Cost of Goods", value: stockVal, color: "#ef4444" },
                { label: "Gross Profit Potential", value: potentialProfit, color: potentialProfit >= 0 ? "#22c55e" : "#ef4444" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "var(--bg-elevated)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{formatPKR(item.value)}</span>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Pricing History</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-3 text-center" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px] font-medium uppercase" style={{ color: "var(--text-secondary)" }}>Cost Price</p>
                <p className="text-xl font-bold mt-1" style={{ color: "#6366f1" }}>{formatPKR(product.cost_price)}</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "var(--bg-elevated)" }}>
                <p className="text-[10px] font-medium uppercase" style={{ color: "var(--text-secondary)" }}>Selling Price</p>
                <p className="text-xl font-bold mt-1" style={{ color: "#22c55e" }}>{formatPKR(product.selling_price)}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Barcode
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "barcode" && (
        <GlassCard>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-secondary)" }}>Barcode Management</h3>
          <div className="flex flex-col items-center gap-4">
            {product.barcode_number ? (
              <>
                <div className="rounded-xl p-6" style={{ background: "white", border: "0.5px solid var(--border-color)" }}>
                  {barcodeImgUrl ? (
                    <img src={barcodeImgUrl} alt="Barcode" style={{ width: "280px", height: "auto" }} />
                  ) : (
                    <div className="flex items-center justify-center" style={{ width: 280, height: 80 }}>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Loading barcode...</p>
                    </div>
                  )}
                  <p className="font-mono text-sm text-center mt-2" style={{ color: "#1a1a2e" }}>{product.barcode_number}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button onClick={onPrintLabel} className="btn-soft text-xs px-4 py-2 flex items-center gap-1.5 rounded-lg"><i className="ti ti-printer" /> Print Label</button>
                  <button onClick={onBarcodeDownload} className="btn-soft text-xs px-4 py-2 flex items-center gap-1.5 rounded-lg"><i className="ti ti-download" /> Download PNG</button>
                  <button onClick={onBarcodeRegen} className="btn-soft text-xs px-4 py-2 flex items-center gap-1.5 rounded-lg"><i className="ti ti-refresh" /> Regenerate</button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <i className="ti ti-barcode-off" style={{ fontSize: "48px", color: "var(--text-secondary)" }} />
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>No barcode generated for this product</p>
                <button onClick={onBarcodeRegen} className="btn-primary text-sm px-4 py-2 mt-3 rounded-lg flex items-center gap-1.5 mx-auto"><i className="ti ti-barcode" /> Generate Barcode</button>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: Timeline
         ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === "timeline" && (
        <GlassCard>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-secondary)" }}>Activity Timeline</h3>
          {timelineLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--bg-elevated)" }} />)}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-8">
              <i className="ti ti-timeline" style={{ fontSize: "32px", color: "var(--text-secondary)" }} />
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>No activity recorded yet</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: "var(--border-color)" }} />
              <div className="space-y-4">
                {timeline.map((entry, i) => (
                  <div key={i} className="relative flex items-start gap-4 pl-2">
                    <div className="relative z-10">
                      <TimelineIcon icon={entry.icon} color={entry.color} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{entry.label}</p>
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `color-mix(in srgb, ${entry.color} 15%, transparent)`, color: entry.color }}>
                          {entry.type}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{entry.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Bottom Quick Actions ── */}
      <GlassCard>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={onAddStock} className="btn-primary text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><i className="ti ti-package-plus" /> Add Stock</button>
          <button onClick={onEdit} className="btn-soft text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><i className="ti ti-pencil" /> Edit Product</button>
          <button onClick={onPrintLabel} className="btn-soft text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><i className="ti ti-printer" /> Print Label</button>
          <button onClick={onBarcodeDownload} className="btn-soft text-xs px-4 py-2 rounded-lg flex items-center gap-1.5"><i className="ti ti-download" /> Download Barcode</button>
          <button onClick={onDelete} className="btn-soft text-xs px-4 py-2 rounded-lg flex items-center gap-1.5" style={{ color: "#ef4444" }}><i className="ti ti-trash" /> Delete</button>
        </div>
      </GlassCard>
    </div>
  );
}

export default function ProductsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { registerPageAction, activeActionId, formatShortcut } = useShortcuts();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingId, setEditingId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: "", price: "" });
  const [form, setForm] = useState({ name: "", cost_price: "", selling_price: "", stock: "", image_data: "", image_mime: "" });
  const [selectedIds, setSelectedIds] = useState(new Set());
  // Smart nudge: show after first manual add in this session
  const sessionAdds = useRef(0);
  const [showNudge, setShowNudge] = useState(false);
  const [barcodeImgUrl, setBarcodeImgUrl] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reset = () => setForm({ name: "", cost_price: "", selling_price: "", stock: "", image_data: "", image_mime: "" });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), selling_price: Number(form.selling_price || 0), stock: Number(form.stock) };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", payload);
        toast.success("Product added successfully");
        // Track manual adds — show nudge after 2nd successful add
        sessionAdds.current += 1;
        if (sessionAdds.current >= 2) setShowNudge(true);
      }
      reset();
      setEditingId(0);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setShowAddDialog(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setSelected(row);
    setForm({
      name: row.name,
      cost_price: String(row.cost_price),
      selling_price: String(row.selling_price || ""),
      stock: String(row.stock),
      image_data: row.image_data || "",
      image_mime: row.image_mime || "",
    });
    setOpen(true);
  };

  const onDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/products/${deleting.id}`);
      toast.info("Product deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete product");
    } finally {
      setDeleteLoading(false);
    }
  };

  const openAddStock = (row) => {
    setStockTarget(row);
    setStockForm({ quantity: "", price: String(row.cost_price || "") });
    setAddStockOpen(true);
  };

  const submitAddStock = async (e) => {
    e.preventDefault();
    if (!stockTarget) return;
    const quantity = Number(stockForm.quantity);
    const parsedPrice = stockForm.price === "" ? null : Number(stockForm.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
      toast.error("Price must be greater than 0");
      return;
    }
    setRestocking(true);
    try {
      const { data } = await api.post(`/products/add-stock/${stockTarget.id}`, {
        quantity,
        price: parsedPrice,
      });
      setItems((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setSelected((prev) => (prev?.id === data.id ? data : prev));
      setAddStockOpen(false);
      setStockTarget(null);
      toast.success("Stock added successfully");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add stock");
    } finally {
      setRestocking(false);
    }
  };

  const rows = useMemo(() => items, [items]);
  const stockTotal = useMemo(() => rows.reduce((sum, row) => sum + Number(row.stock || 0), 0), [rows]);
  const avgCost = useMemo(() => (rows.length ? rows.reduce((sum, row) => sum + Number(row.cost_price || 0), 0) / rows.length : 0), [rows]);

  const getStockMeta = (stock) => {
    if (stock === 0) {
      return {
        label: "Out of Stock",
        badgeClass: "border border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
        rowClass: "bg-rose-50/60 dark:bg-rose-950/25",
      };
    }
    if (stock <= 10) {
      return {
        label: "Low Stock",
        badgeClass: "border border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        rowClass: "bg-amber-50/60 dark:bg-amber-950/20",
      };
    }
    return {
      label: "",
      badgeClass: "",
      rowClass: "",
    };
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Only JPG and PNG files are allowed");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image_data: String(reader.result), image_mime: file.type }));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubs = [
      registerPageAction("products.add", openCreate, { enabled: true }),
      registerPageAction("products.editSelected", () => selected && selected.stock > 0 && openEdit(selected), { enabled: !!selected && selected.stock > 0 }),
      registerPageAction("products.deleteSelected", () => selected && setDeleting(selected), { enabled: !!selected && role === "owner" }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [registerPageAction, role, selected, rows]);

  useEffect(() => {
    if (viewOpen && selected?.barcode_number) {
      let cancelled = false;
      posApi.getBarcodeImage(selected.id)
        .then((blob) => { if (!cancelled) setBarcodeImgUrl(URL.createObjectURL(blob)); })
        .catch(() => { if (!cancelled) setBarcodeImgUrl(null); });
      return () => { cancelled = true; setBarcodeImgUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); };
    } else {
      setBarcodeImgUrl(null);
    }
  }, [viewOpen, selected?.id, selected?.barcode_number]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.has(r.id)), [rows, selectedIds]);

  const columns = [
    {
      key: "select", label: "", headerRender: () => (
        <input type="checkbox" className="w-4 h-4 accent-teal-500 cursor-pointer" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleSelectAll} />
      ),
      render: (row) => (
        <input type="checkbox" className="w-4 h-4 accent-teal-500 cursor-pointer" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: "image", label: "Image", render: (row) => row.image_data ? <img className="thumb-image" src={row.image_data} alt={row.name} /> : <span style={{ color: "var(--text-secondary)" }}>-</span> },
    { key: "name", label: "Name" },
    { key: "cost_price", label: "Cost Price", render: (row) => formatPKR(row.cost_price) },
    {
      key: "stock",
      label: "Stock",
      render: (row) => {
        const meta = getStockMeta(Number(row.stock || 0));
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.stock}</span>
            {meta.label && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.badgeClass}`}>{meta.label}</span>}
          </div>
        );
      },
    },
    {
      key: "barcode_number", label: "Barcode",
      render: (row) => row.barcode_number ? (
        <span className="font-mono text-xs">{row.barcode_number}</span>
      ) : (
        <button
          className="text-xs text-indigo-400 hover:text-indigo-300"
          onClick={async () => {
            try {
              await posApi.generateBarcode(row.id);
              await load();
              toast.success("Barcode generated");
            } catch { toast.error("Failed to generate barcode"); }
          }}
        >
          Generate
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button className="icon-btn icon-btn-view" onClick={() => openAddStock(row)} disabled={role !== "owner"} title="Add Stock">
            <i className="ti ti-package-plus" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-view" onClick={() => { setSelected(row); setViewOpen(true); }} title="View">
            <i className="ti ti-eye" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-edit" onClick={() => openEdit(row)} disabled={role !== "owner"} title="Edit">
            <i className="ti ti-pencil" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-view" onClick={() => {
            const bcNum = row.barcode_number;
            if (!bcNum) {
              posApi.generateBarcode(row.id).then(() => {
                load();
                printSingleBarcode(row.id, row.name, row.selling_price, row.barcode_number || "");
              }).catch(() => toast.error("Generate barcode first"));
              return;
            }
            printSingleBarcode(row.id, row.name, row.selling_price, bcNum);
          }} title="Print Label">
            <i className="ti ti-barcode" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-print" onClick={() => printRecord({
            title: "Product Details",
            fields: [
              { label: "Name", value: row.name },
              { label: "SKU", value: row.sku || "—" },
              { label: "Stock", value: row.stock },
              { label: "Cost Price", value: formatPKR(row.cost_price) },
              { label: "Selling Price", value: formatPKR(row.selling_price) },
              { label: "Category", value: row.category || "—" },
            ],
          })} title="Print">
            <i className="ti ti-printer" style={{ fontSize: "16px" }} />
          </button>
          <button className="icon-btn icon-btn-danger" onClick={() => setDeleting(row)} disabled={role !== "owner"} title="Delete Record">
            <i className="ti ti-trash" style={{ fontSize: "16px" }} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle="Manage catalog and stock levels"
        actions={
          <>
            <button
              className={`btn-soft ${activeActionId === "products.editSelected" ? "ring-2 ring-indigo-500" : ""}`}
              title={`Edit Selected (${formatShortcut("products.editSelected")})`}
              onClick={() => selected && openEdit(selected)}
            >
              Edit Selected ({formatShortcut("products.editSelected")})
            </button>

            {/* Print Selected Labels */}
            {selectedIds.size > 0 && (
              <button
                className="btn-primary"
                onClick={() => {
                  const items = selectedRows.map((r) => ({
                    id: r.id, name: r.name, selling_price: r.selling_price, barcode_number: r.barcode_number,
                  }));
                  printBulkBarcodes(items);
                }}
              >
                🖨 Print Selected ({selectedIds.size})
              </button>
            )}

            {/* Bulk Barcode Generation */}
            <button
              className="btn-soft"
              onClick={async () => {
                try {
                  const result = await posApi.bulkGenerateBarcodes();
                  toast.success(`Generated ${result.generated} barcodes`);
                  await load();
                } catch { toast.error("Bulk generation failed"); }
              }}
              title="Generate barcodes for all products without one"
            >
              <i className="ti ti-barcode mr-1" /> Bulk Barcodes
            </button>

            {/* Import Products button — always visible, navigates to Bulk Import tab */}
            <button
              className="btn-soft relative"
              style={{
                borderColor: showNudge ? "#6366F1" : undefined,
                color: showNudge ? "#6366F1" : undefined,
                boxShadow: showNudge ? "0 0 0 2px #6366F144" : undefined,
                animation: showNudge ? "nudge-pulse 2s ease-in-out infinite" : undefined,
              }}
              onClick={() => navigate("/analytics", { state: { tab: "Bulk Import" } })}
              title="Import products from Excel"
            >
              ⬆ Import Products
            </button>

            <button
              className={`btn-primary ${activeActionId === "products.add" ? "ring-2 ring-indigo-500" : ""}`}
              title={`Add Product (${formatShortcut("products.add")})`}
              onClick={openCreate}
            >
              + Add Product ({formatShortcut("products.add")})
            </button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Products" value={rows.length} tone="indigo" icon="ti-box" />
        <StatCard title="Total Stock" value={stockTotal} tone="amber" icon="ti-packages" />
        <StatCard title="Avg Cost" value={avgCost} tone="emerald" money icon="ti-calculator" />
      </div>

      {/* Nudge tooltip — appears below stat cards pointing up at the Import button */}
      {showNudge && (
        <ImportNudgeTooltip onDismiss={() => setShowNudge(false)} />
      )}

      {loading ? <LoadingSkeleton rows={6} /> : rows.length === 0 ? (
        <EmptyState title="No products yet" description="Create your first product to start inventory tracking." />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          rowClassName={(row) => getStockMeta(Number(row.stock || 0)).rowClass}
          searchPlaceholder="Search products by name, price, or stock..."
          searchableColumns={["name", "cost_price", "stock", "barcode_number"]}
        />
      )}

      <AddProductDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => { setShowAddDialog(false); load(); }}
      />

      <Modal title={editingId ? "Edit Product" : "Add Product"} open={open} onClose={() => setOpen(false)}>
        <form className="grid grid-cols-1 gap-3" onSubmit={submit}>
          <input className="input" placeholder="Product name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Cost price (PKR)" type="number" min="0" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} required />
          <input className="input" placeholder="Selling price (PKR)" type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
          <input className="input" placeholder="Stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
          <input className="input" type="file" accept="image/jpeg,image/png" onChange={handleImageUpload} />
          {form.image_data && <img src={form.image_data} alt="Product preview" className="h-28 w-28 rounded-lg object-cover" />}
          <button className="btn-primary" disabled={submitting}>{submitting ? "Saving..." : editingId ? "Update Product" : "Save Product"}</button>
        </form>
      </Modal>

      <Modal title="" open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="max-w-6xl" hideTitle>
        {selected && (
          <ProductDetailDashboard
            product={selected}
            barcodeImgUrl={barcodeImgUrl}
            onClose={() => setViewOpen(false)}
            onEdit={() => { setViewOpen(false); openEdit(selected); }}
            onDelete={() => { setViewOpen(false); setDeleting(selected); }}
            onAddStock={() => { setViewOpen(false); openAddStock(selected); }}
            onBarcodeRegen={async () => {
              try {
                await posApi.generateBarcode(selected.id);
                toast.success("Barcode regenerated");
                await load();
                const all = (await api.get("/products")).data;
                const found = all.find((p) => p.id === selected.id);
                if (found) setSelected(found);
              } catch { toast.error("Failed to regenerate barcode"); }
            }}
            onBarcodeDownload={async () => {
              try {
                const blob = await posApi.getBarcodeImage(selected.id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `barcode_${selected.id}.png`; a.click();
                URL.revokeObjectURL(url);
              } catch { toast.error("Failed to download barcode"); }
            }}
            onPrintLabel={() => printSingleBarcode(selected.id, selected.name, selected.selling_price, selected.barcode_number)}
          />
        )}
      </Modal>

      <Modal title={`Add Stock${stockTarget ? ` - ${stockTarget.name}` : ""}`} open={addStockOpen} onClose={() => setAddStockOpen(false)} maxWidth="max-w-md">
        <form className="grid gap-3" onSubmit={submitAddStock}>
          <div>
            <label className="mb-1 block text-sm" style={{ color: "var(--text-secondary)" }}>Quantity</label>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={stockForm.quantity}
              onChange={(e) => setStockForm((prev) => ({ ...prev, quantity: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm" style={{ color: "var(--text-secondary)" }}>Price per unit</label>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              value={stockForm.price}
              onChange={(e) => setStockForm((prev) => ({ ...prev, price: e.target.value }))}
            />
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border-color)" }}>
            Total: {formatPKR((Number(stockForm.quantity) || 0) * (Number(stockForm.price) || 0))}
          </div>
          <button className="btn-primary" disabled={restocking || !stockForm.quantity || Number(stockForm.quantity) <= 0 || (stockForm.price !== "" && Number(stockForm.price) <= 0)}>
            {restocking ? "Adding stock..." : "Add Stock"}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        description={`Delete "${deleting?.name || "this product"}"? This cannot be undone.`}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
