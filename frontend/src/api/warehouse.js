import api from "./client";

export const warehouseApi = {
  list: () => api.get("/warehouses").then((r) => r.data),
  get: (id) => api.get(`/warehouses/${id}`).then((r) => r.data),
  create: (data) => api.post("/warehouses", data).then((r) => r.data),

  stockIn: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/stock-in`, items, { params }).then((r) => r.data),

  stockOut: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/stock-out`, items, { params }).then((r) => r.data),

  transfer: (items, params) =>
    api.post("/warehouses/transfer", items, { params }).then((r) => r.data),

  adjust: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/adjust`, items, { params }).then((r) => r.data),

  returnToSupplier: (warehouseId, items, params) =>
    api.post(`/warehouses/${warehouseId}/return-supplier`, items, { params }).then((r) => r.data),

  reportDamage: (warehouseId, params) =>
    api.post(`/warehouses/${warehouseId}/damage`, null, { params }).then((r) => r.data),

  setOpeningStock: (warehouseId, items) =>
    api.post(`/warehouses/${warehouseId}/opening-stock`, items).then((r) => r.data),

  stockSummary: (warehouseId) =>
    api.get("/warehouses/stock/summary", { params: { warehouse_id: warehouseId } }).then((r) => r.data),

  stockLedger: (params) =>
    api.get("/warehouses/stock/ledger", { params }).then((r) => r.data),

  lowStock: () => api.get("/warehouses/stock/low-stock").then((r) => r.data),

  transactions: (params) =>
    api.get("/warehouses/stock/transactions", { params }).then((r) => r.data),

  damageReports: (warehouseId) =>
    api.get("/warehouses/damage-reports", { params: { warehouse_id: warehouseId } }).then((r) => r.data),

  warehouseSummary: () => api.get("/warehouses/reports/summary").then((r) => r.data),

  calculateClosing: () => api.post("/warehouses/reports/calculate-closing").then((r) => r.data),

  createCycleCount: (warehouseId) =>
    api.post(`/warehouses/${warehouseId}/cycle-count`).then((r) => r.data),

  updateCycleCountItem: (countId, itemId, countedQty) =>
    api.put(`/warehouses/cycle-count/${countId}/item/${itemId}`, null, { params: { counted_qty: countedQty } }).then((r) => r.data),

  completeCycleCount: (countId, params) =>
    api.post(`/warehouses/cycle-count/${countId}/complete`, null, { params }).then((r) => r.data),
};
