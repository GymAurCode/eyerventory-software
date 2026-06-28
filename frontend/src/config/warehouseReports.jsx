import { formatPKR } from "../utils/currency";

export const REPORT_GROUPS = [
  {
    id: "stock", label: "Stock Reports",
    reports: [
      {
        id: "r101", label: "Current Stock",
        filters: ["warehouse", "product", "category"],
        columns: [
          { key: "product_name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "closing_qty", label: "Qty" },
          { key: "rate", label: "Rate", render: (r) => formatPKR(r.rate || 0) },
          { key: "stock_value", label: "Value", render: (r) => formatPKR(r.stock_value || 0) },
        ],
        summary: (rows) => `Total Items: ${rows.length}  |  Total Value: ${formatPKR(rows.reduce((s, r) => s + (r.stock_value || 0), 0))}`,
      },
      {
        id: "r102", label: "Stock Movements",
        filters: ["warehouse", "product", "dateRange", "movementType"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "movement_type", label: "Type", render: (r) => <span className="capitalize">{(r.movement_type || "").replace(/_/g, " ")}</span> },
          { key: "qty", label: "Qty" },
          { key: "rate", label: "Rate", render: (r) => formatPKR(r.rate || 0) },
          { key: "value", label: "Value", render: (r) => formatPKR(r.value || 0) },
        ],
        summary: (rows) => `In: ${formatPKR(rows.reduce((s, r) => s + (r.qty > 0 ? r.value : 0), 0))}  |  Out: ${formatPKR(rows.reduce((s, r) => s + (r.qty < 0 ? r.value : 0), 0))}`,
      },
      {
        id: "r103", label: "Opening / Closing Stock",
        filters: ["warehouse", "product"],
        columns: [
          { key: "product_name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "opening_qty", label: "Opening" },
          { key: "total_in", label: "In" },
          { key: "total_out", label: "Out" },
          { key: "closing_qty", label: "Closing" },
          { key: "closing_value", label: "Closing Value", render: (r) => formatPKR(r.closing_value || 0) },
        ],
        summary: (rows) => `Total Closing Value: ${formatPKR(rows.reduce((s, r) => s + (r.closing_value || 0), 0))}`,
      },
      {
        id: "r104", label: "Stock Valuation",
        filters: ["warehouse", "category"],
        columns: [
          { key: "product_name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "qty", label: "Qty" },
          { key: "avg_rate", label: "Avg Rate", render: (r) => formatPKR(r.avg_rate || 0) },
          { key: "total_value", label: "Total Value", render: (r) => formatPKR(r.total_value || 0) },
        ],
        summary: (rows) => `Grand Total: ${formatPKR(rows.reduce((s, r) => s + (r.total_value || 0), 0))}`,
      },
      {
        id: "r105", label: "Low Stock Alerts",
        filters: ["warehouse", "category"],
        columns: [
          { key: "product_name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "current_qty", label: "Current Qty", render: (r) => <span style={{ color: r.current_qty <= r.min_threshold ? "#ef4444" : "#f59e0b" }}>{r.current_qty}</span> },
          { key: "min_threshold", label: "Min Threshold" },
          { key: "shortage_qty", label: "Shortage" },
        ],
        summary: (rows) => `Total Shortage: ${rows.reduce((s, r) => s + (r.shortage_qty || 0), 0)} units`,
      },
      {
        id: "r106", label: "Damage Report",
        filters: ["warehouse", "product", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "product_id", label: "Product ID" },
          { key: "qty", label: "Qty" },
          { key: "loss_value", label: "Loss Value", render: (r) => formatPKR(r.loss_value || 0) },
          { key: "reason", label: "Reason" },
        ],
        summary: (rows) => `Total Loss: ${formatPKR(rows.reduce((s, r) => s + (r.loss_value || 0), 0))}`,
      },
      {
        id: "r107", label: "Stock Ledger",
        filters: ["warehouse", "product", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "transaction_type", label: "Type" },
          { key: "in_qty", label: "In" },
          { key: "out_qty", label: "Out" },
          { key: "balance_qty", label: "Balance" },
          { key: "narration", label: "Narration" },
        ],
        summary: () => null,
      },
    ],
  },
  {
    id: "salesman", label: "Salesman Reports",
    reports: [
      {
        id: "r201", label: "Salesman Performance",
        filters: ["salesman", "dateRange"],
        columns: [
          { key: "salesman_id", label: "Salesman" },
          { key: "total_deliveries", label: "Deliveries" },
          { key: "total_amount", label: "Amount", render: (r) => formatPKR(r.total_amount || 0) },
          { key: "cash_collected", label: "Collected", render: (r) => formatPKR(r.cash_collected || 0) },
          { key: "outstanding", label: "Outstanding", render: (r) => formatPKR(r.outstanding || 0) },
        ],
        summary: (rows) => `Total: ${formatPKR(rows.reduce((s, r) => s + (r.total_amount || 0), 0))}  |  Collected: ${formatPKR(rows.reduce((s, r) => s + (r.cash_collected || 0), 0))}`,
      },
      {
        id: "r202", label: "Salesman Deliveries",
        filters: ["salesman", "shop", "dateRange"],
        required: ["salesman"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "invoice_no", label: "Invoice#" },
          { key: "shop_id", label: "Shop" },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
          { key: "status", label: "Status" },
        ],
        summary: (rows) => `Delivered: ${formatPKR(rows.reduce((s, r) => s + (r.net_total || 0), 0))}  |  Collected: ${formatPKR(rows.reduce((s, r) => s + (r.paid || 0), 0))}  |  Pending: ${formatPKR(rows.reduce((s, r) => s + (r.balance || 0), 0))}`,
      },
      {
        id: "r203", label: "Salesman Collections",
        filters: ["salesman", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "amount", label: "Amount", render: (r) => formatPKR(r.amount || 0) },
          { key: "payment_mode", label: "Mode" },
        ],
        summary: (rows) => `Total Collection: ${formatPKR(rows.reduce((s, r) => s + (r.amount || 0), 0))}`,
      },
      {
        id: "r204", label: "Salesman Outstanding",
        filters: ["salesman", "aging"],
        columns: [
          { key: "invoice_no", label: "Invoice#" },
          { key: "invoice_date", label: "Date", render: (r) => r.invoice_date ? new Date(r.invoice_date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
          { key: "days_overdue", label: "Days" },
          { key: "aging_bucket", label: "Bucket" },
        ],
        summary: (rows) => `Total Outstanding: ${formatPKR(rows.reduce((s, r) => s + (r.balance || 0), 0))}`,
      },
      {
        id: "r205", label: "Salesman Area Coverage",
        columns: [
          { key: "salesman_id", label: "Salesman" },
          { key: "warehouse_id", label: "Warehouse" },
          { key: "shops_covered", label: "Shops" },
          { key: "total_sales", label: "Sales", render: (r) => formatPKR(r.total_sales || 0) },
          { key: "collection", label: "Collection", render: (r) => formatPKR(r.collection || 0) },
          { key: "outstanding", label: "Outstanding", render: (r) => formatPKR(r.outstanding || 0) },
        ],
        summary: (rows) => `Shops: ${rows.reduce((s, r) => s + (r.shops_covered || 0), 0)}  |  Sales: ${formatPKR(rows.reduce((s, r) => s + (r.total_sales || 0), 0))}`,
      },
    ],
  },
  {
    id: "shop", label: "Shop Reports",
    reports: [
      {
        id: "r301", label: "Shop Purchase History",
        filters: ["shop", "salesman", "product", "dateRange"],
        required: ["shop"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "invoice_no", label: "Invoice#" },
          { key: "gross", label: "Gross", render: (r) => formatPKR(r.gross || 0) },
          { key: "discount", label: "Discount", render: (r) => formatPKR(r.discount || 0) },
          { key: "net", label: "Net", render: (r) => formatPKR(r.net || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: (rows) => `Purchased: ${formatPKR(rows.reduce((s, r) => s + (r.net || 0), 0))}  |  Paid: ${formatPKR(rows.reduce((s, r) => s + (r.paid || 0), 0))}  |  Due: ${formatPKR(rows.reduce((s, r) => s + (r.balance || 0), 0))}`,
      },
      {
        id: "r302", label: "Shop Outstanding",
        filters: ["salesman", "aging"],
        columns: [
          { key: "shop_id", label: "Shop" },
          { key: "total_invoices", label: "Invoices" },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: (rows) => `Total Outstanding: ${formatPKR(rows.reduce((s, r) => s + (r.balance || 0), 0))}`,
      },
      {
        id: "r303", label: "Shop Ledger",
        filters: ["shop", "dateRange"],
        required: ["shop"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "type", label: "Type" },
          { key: "reference", label: "Reference" },
          { key: "debit", label: "Debit", render: (r) => formatPKR(r.debit || 0) },
          { key: "credit", label: "Credit", render: (r) => formatPKR(r.credit || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: (rows) => rows.length ? `Current Balance: ${formatPKR(rows[rows.length - 1].balance || 0)}` : null,
      },
      {
        id: "r304", label: "Top Shops",
        filters: ["salesman", "dateRange"],
        columns: [
          { key: "shop_id", label: "Shop" },
          { key: "total_purchases", label: "Purchases", render: (r) => formatPKR(r.total_purchases || 0) },
          { key: "total_paid", label: "Paid", render: (r) => formatPKR(r.total_paid || 0) },
          { key: "outstanding", label: "Outstanding", render: (r) => formatPKR(r.outstanding || 0) },
        ],
        summary: () => null,
      },
      {
        id: "r305", label: "Shop Returns",
        filters: ["shop", "salesman", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "return_qty", label: "Qty" },
          { key: "return_value", label: "Value", render: (r) => formatPKR(r.return_value || 0) },
          { key: "reason", label: "Reason" },
        ],
        summary: (rows) => `Total Returns: ${formatPKR(rows.reduce((s, r) => s + (r.return_value || 0), 0))}`,
      },
    ],
  },
  {
    id: "invoice", label: "Invoice Reports",
    reports: [
      {
        id: "r401", label: "Invoice List",
        filters: ["warehouse", "salesman", "shop", "dateRange", "status"],
        columns: [
          { key: "invoice_no", label: "Invoice#" },
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
          { key: "status", label: "Status" },
        ],
        summary: (rows) => `Invoiced: ${formatPKR(rows.reduce((s, r) => s + (r.net_total || 0), 0))}  |  Collected: ${formatPKR(rows.reduce((s, r) => s + (r.paid || 0), 0))}  |  Pending: ${formatPKR(rows.reduce((s, r) => s + (r.balance || 0), 0))}`,
      },
      {
        id: "r402", label: "Daily Delivery",
        filters: ["date", "salesman", "warehouse"],
        required: ["date"],
        columns: [
          { key: "invoice_no", label: "Invoice#" },
          { key: "shop_id", label: "Shop" },
          { key: "products", label: "Products" },
          { key: "total_qty", label: "Qty" },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
          { key: "paid", label: "Paid", render: (r) => formatPKR(r.paid || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: (rows) => `Total: ${formatPKR(rows.reduce((s, r) => s + (r.net_total || 0), 0))}`,
      },
      {
        id: "r403", label: "Product Sales",
        filters: ["product", "warehouse", "salesman", "dateRange"],
        columns: [
          { key: "product_id", label: "Product" },
          { key: "total_qty", label: "Qty Sold" },
          { key: "total_amount", label: "Amount", render: (r) => formatPKR(r.total_amount || 0) },
          { key: "avg_rate", label: "Avg Rate", render: (r) => formatPKR(r.avg_rate || 0) },
        ],
        summary: (rows) => `Total Sales: ${formatPKR(rows.reduce((s, r) => s + (r.total_amount || 0), 0))}`,
      },
      {
        id: "r404", label: "Discount Report",
        filters: ["salesman", "shop", "dateRange"],
        columns: [
          { key: "invoice_no", label: "Invoice#" },
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "gross_total", label: "Gross", render: (r) => formatPKR(r.gross_total || 0) },
          { key: "discount", label: "Discount", render: (r) => formatPKR(r.discount || 0) },
          { key: "discount_pct", label: "Disc %", render: (r) => `${r.discount_pct || 0}%` },
          { key: "net_total", label: "Net", render: (r) => formatPKR(r.net_total || 0) },
        ],
        summary: (rows) => `Total Discount: ${formatPKR(rows.reduce((s, r) => s + (r.discount || 0), 0))}`,
      },
    ],
  },
  {
    id: "payment", label: "Payment Reports",
    reports: [
      {
        id: "r501", label: "Daily Collection",
        filters: ["salesman", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "amount", label: "Amount", render: (r) => formatPKR(r.amount || 0) },
          { key: "payment_mode", label: "Mode" },
        ],
        summary: (rows) => `Grand Total: ${formatPKR(rows.reduce((s, r) => s + (r.amount || 0), 0))}`,
      },
      {
        id: "r502", label: "Payment History",
        filters: ["shop", "salesman", "dateRange", "paymentMode"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "shop_id", label: "Shop" },
          { key: "amount", label: "Amount", render: (r) => formatPKR(r.amount || 0) },
          { key: "payment_mode", label: "Mode" },
          { key: "reference", label: "Reference" },
        ],
        summary: (rows) => `Total: ${formatPKR(rows.reduce((s, r) => s + (r.amount || 0), 0))}`,
      },
      {
        id: "r503", label: "Outstanding Aging",
        filters: ["salesman", "aging"],
        columns: [
          { key: "shop_id", label: "Shop" },
          { key: "total_outstanding", label: "Outstanding", render: (r) => formatPKR(r.total_outstanding || 0) },
          { key: "0-30", label: "0-30 Days", render: (r) => formatPKR(r["0-30"] || 0) },
          { key: "31-60", label: "31-60 Days", render: (r) => formatPKR(r["31-60"] || 0) },
          { key: "61-90", label: "61-90 Days", render: (r) => formatPKR(r["61-90"] || 0) },
          { key: "90+", label: "90+ Days", render: (r) => formatPKR(r["90+"] || 0) },
        ],
        summary: null,
      },
      {
        id: "r504", label: "Cash Flow",
        filters: ["salesman", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "cash_in", label: "Cash In", render: (r) => formatPKR(r.cash_in || 0) },
          { key: "cash_out", label: "Cash Out", render: (r) => formatPKR(r.cash_out || 0) },
          { key: "opening_balance", label: "Opening", render: (r) => formatPKR(r.opening_balance || 0) },
          { key: "closing_balance", label: "Closing", render: (r) => formatPKR(r.closing_balance || 0) },
        ],
        summary: (rows) => `Total In: ${formatPKR(rows.reduce((s, r) => s + (r.cash_in || 0), 0))}`,
      },
    ],
  },
  {
    id: "transfer", label: "Transfer & Return Reports",
    reports: [
      {
        id: "r601", label: "Transfer Report",
        filters: ["warehouse", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "from_warehouse", label: "From" },
          { key: "to_warehouse", label: "To" },
          { key: "product_id", label: "Product" },
          { key: "qty", label: "Qty" },
          { key: "value", label: "Value", render: (r) => formatPKR(r.value || 0) },
        ],
        summary: (rows) => `Total Transferred Value: ${formatPKR(rows.reduce((s, r) => s + (r.value || 0), 0))}`,
      },
      {
        id: "r602", label: "Returns Combined",
        filters: ["returnType", "warehouse", "product", "dateRange"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "return_type", label: "Type" },
          { key: "shop_id", label: "Shop" },
          { key: "product_id", label: "Product" },
          { key: "qty", label: "Qty" },
          { key: "value", label: "Value", render: (r) => formatPKR(r.value || 0) },
          { key: "reason", label: "Reason" },
        ],
        summary: (rows) => `Total Returns Value: ${formatPKR(rows.reduce((s, r) => s + (r.value || 0), 0))}`,
      },
    ],
  },
  {
    id: "finance", label: "Finance / COA Reports",
    reports: [
      {
        id: "r701", label: "Trial Balance",
        filters: ["warehouse"],
        required: ["warehouse"],
        columns: [
          { key: "account_code", label: "Code" },
          { key: "account_name", label: "Account" },
          { key: "account_type", label: "Type" },
          { key: "debit", label: "Debit", render: (r) => formatPKR(r.debit || 0) },
          { key: "credit", label: "Credit", render: (r) => formatPKR(r.credit || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: (rows) => {
          const dr = rows.reduce((s, r) => s + (r.debit || 0), 0);
          const cr = rows.reduce((s, r) => s + (r.credit || 0), 0);
          return `Total Debits: ${formatPKR(dr)}  |  Total Credits: ${formatPKR(cr)}  |  ${dr === cr ? "✓ Balanced" : "✗ Unbalanced"}`;
        },
      },
      {
        id: "r702", label: "Journal Entries",
        filters: ["warehouse", "dateRange"],
        required: ["warehouse"],
        columns: [
          { key: "id", label: "JE#" },
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "reference", label: "Reference" },
          { key: "narration", label: "Narration" },
          { key: "lines", label: "Lines", render: (r) => `${(r.lines || []).length} entries` },
        ],
        summary: null,
      },
      {
        id: "r703", label: "Account Ledger",
        filters: ["warehouse", "dateRange"],
        required: ["warehouse"],
        columns: [
          { key: "date", label: "Date", render: (r) => r.date ? new Date(r.date).toLocaleDateString() : "-" },
          { key: "reference", label: "Reference" },
          { key: "narration", label: "Narration" },
          { key: "debit", label: "Debit", render: (r) => formatPKR(r.debit || 0) },
          { key: "credit", label: "Credit", render: (r) => formatPKR(r.credit || 0) },
          { key: "balance", label: "Balance", render: (r) => formatPKR(r.balance || 0) },
        ],
        summary: null,
      },
      {
        id: "r704", label: "Profit & Loss",
        filters: ["warehouse", "dateRange"],
        required: ["warehouse"],
        columns: [
          { key: "label", label: "Account" },
          { key: "amount", label: "Amount", render: (r) => <span style={{ color: r.amount >= 0 ? "#22c55e" : "#ef4444" }}>{formatPKR(r.amount)}</span> },
          { key: "type", label: "Type" },
        ],
        summary: (rows) => {
          const net = rows.find((r) => r.label === "Net Profit / Loss");
          return net ? `Net Profit/Loss: ${formatPKR(net.amount)}` : "";
        },
      },
    ],
  },
];

export function getAllReports() {
  return REPORT_GROUPS.flatMap((g) => g.reports.map((r) => ({ ...r, group: g.label })));
}

export function getReportById(id) {
  return getAllReports().find((r) => r.id === id);
}
