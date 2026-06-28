import api from "./client";

export const warehouseApi = {
  // ── Warehouses ──
  list: () => api.get("/warehouses").then((r) => r.data),
  get: (id) => api.get(`/warehouses/${id}`).then((r) => r.data),
  create: (data) => api.post("/warehouses", data).then((r) => r.data),
  update: (id, data) => api.put(`/warehouses/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/warehouses/${id}`).then((r) => r.data),

  // ── Stock Operations ──
  stockIn: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/stock-in`, items, { params }).then((r) => r.data),
  stockOut: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/stock-out`, items, { params }).then((r) => r.data),
  transfer: (data) => api.post("/warehouses/transfer", data).then((r) => r.data),
  adjust: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/adjust`, items, { params }).then((r) => r.data),
  reportDamage: (data) => api.post(`/warehouses/${data.warehouse_id}/damage`, data).then((r) => r.data),

  stockSummary: (warehouseId) =>
    api.get("/warehouses/stock/summary", { params: { warehouse_id: warehouseId } }).then((r) => r.data),
  stockMovements: (warehouseId, params) =>
    api.get(`/warehouses/${warehouseId}/stock-movements`, { params }).then((r) => r.data),
  stockLedger: (warehouseId, params) =>
    api.get(`/warehouses/${warehouseId}/stock-ledger`, { params }).then((r) => r.data),
  lowStock: () => api.get("/warehouses/stock/low-stock").then((r) => r.data),
  transactions: (params) =>
    api.get("/warehouses/stock/transactions", { params }).then((r) => r.data),
  damageReports: (warehouseId) =>
    api.get("/warehouses/damage-reports", { params: { warehouse_id: warehouseId } }).then((r) => r.data),

  // ── Opening Stock ──
  getOpeningStock: (warehouseId) =>
    api.get(`/warehouses/${warehouseId}/opening-stock`).then((r) => r.data),
  setOpeningStock: (warehouseId, items) =>
    api.post(`/warehouses/${warehouseId}/opening-stock`, items).then((r) => r.data),
  lockOpeningStock: (warehouseId) =>
    api.post(`/warehouses/${warehouseId}/opening-stock/lock`).then((r) => r.data),

  // ── Returns ──
  getReturns: (warehouseId, params) =>
    api.get(`/warehouses/${warehouseId}/returns`, { params }).then((r) => r.data),
  createReturn: (warehouseId, data) =>
    api.post(`/warehouses/${warehouseId}/returns`, data).then((r) => r.data),

  // ── COA Settings ──
  getCOASetting: (warehouseId) =>
    api.get(`/warehouses/${warehouseId}/coa-setting`).then((r) => r.data),
  updateCOASetting: (warehouseId, data) =>
    api.put(`/warehouses/${warehouseId}/coa-setting`, data).then((r) => r.data),
  getCOAAccounts: (warehouseId) =>
    api.get(`/warehouses/${warehouseId}/coa-accounts`).then((r) => r.data),
  getCOAAccountDetail: (warehouseId, accountId) =>
    api.get(`/warehouses/${warehouseId}/coa-accounts/${accountId}`).then((r) => r.data),
  createCOAAccount: (warehouseId, data) =>
    api.post(`/warehouses/${warehouseId}/coa-accounts`, data).then((r) => r.data),
  deleteCOAAccount: (warehouseId, accountId) =>
    api.delete(`/warehouses/${warehouseId}/coa-accounts/${accountId}`).then((r) => r.data),
  getJournalEntries: (warehouseId, params) =>
    api.get(`/warehouses/${warehouseId}/journal-entries`, { params }).then((r) => r.data),
  getTrialBalance: (warehouseId) =>
    api.get(`/warehouses/${warehouseId}/trial-balance`).then((r) => r.data),

  // ── Dashboard ──
  getDashboard: () => api.get("/warehouses/dashboard").then((r) => r.data),
  warehouseSummary: () => api.get("/warehouses/reports/summary").then((r) => r.data),
  calculateClosing: () => api.post("/warehouses/reports/calculate-closing").then((r) => r.data),

  // ── Cycle Count (legacy) ──
  createCycleCount: (warehouseId) =>
    api.post(`/warehouses/${warehouseId}/cycle-count`).then((r) => r.data),
  updateCycleCountItem: (countId, itemId, countedQty) =>
    api.put(`/warehouses/cycle-count/${countId}/item/${itemId}`, null, { params: { counted_qty: countedQty } }).then((r) => r.data),
  completeCycleCount: (countId, params) =>
    api.post(`/warehouses/cycle-count/${countId}/complete`, null, { params }).then((r) => r.data),

  // ── Shops ──
  listShops: (params) => api.get("/shops", { params }).then((r) => r.data),
  getShop: (id) => api.get(`/shops/${id}`).then((r) => r.data),
  createShop: (data) => api.post("/shops", data).then((r) => r.data),
  updateShop: (id, data) => api.put(`/shops/${id}`, data).then((r) => r.data),
  deleteShop: (id) => api.delete(`/shops/${id}`).then((r) => r.data),
  getShopLedger: (id) => api.get(`/shops/${id}/ledger`).then((r) => r.data),

  // ── Invoices ──
  listInvoices: (params) => api.get("/invoices", { params }).then((r) => r.data),
  getInvoice: (id) => api.get(`/invoices/${id}`).then((r) => r.data),
  createInvoice: (data) => api.post("/invoices", data).then((r) => r.data),
  getInvoicePrint: (id) => api.get(`/invoices/${id}/print`).then((r) => r.data),

  // ── Payments ──
  listPayments: (params) => api.get("/payments", { params }).then((r) => r.data),
  createPayment: (data) => api.post("/payments", data).then((r) => r.data),
  getDailyCollection: (params) =>
    api.get("/payments/daily-collection", { params }).then((r) => r.data),

  // ── Reports (legacy, kept for backward compat) ──
  getStockValuation: (params) =>
    api.get("/reports/stock-valuation", { params }).then((r) => r.data),
  getLowStockReport: () => api.get("/reports/low-stock").then((r) => r.data),
  getStockMovementReport: (params) =>
    api.get("/reports/stock-movements", { params }).then((r) => r.data),
  getDamageReport: (params) =>
    api.get("/reports/damage", { params }).then((r) => r.data),
  getReturnReport: (params) =>
    api.get("/reports/returns", { params }).then((r) => r.data),
  getSalesmanPerformance: () =>
    api.get("/reports/salesman-performance").then((r) => r.data),
  getShopOutstanding: () =>
    api.get("/reports/shop-outstanding").then((r) => r.data),
  getOutstandingAging: (params) =>
    api.get("/reports/outstanding-aging", { params }).then((r) => r.data),
  getProfitLoss: (params) =>
    api.get("/reports/profit-loss", { params }).then((r) => r.data),

  // ── Warehouse Reports (new dispatch API) ──
  listWarehouseReports: () =>
    api.get("/warehouse-reports/").then((r) => r.data),

  getWarehouseReport: (reportId, params) =>
    api.get(`/warehouse-reports/${reportId}`, { params }).then((r) => r.data),
};
