import api from "./client";

// ── Chart of Accounts ─────────────────────────────────────────────────────────
export const getAccounts = () => api.get("/accounting/accounts").then((r) => r.data);
export const getJournalEntries = () => api.get("/accounting/journal-entries").then((r) => r.data);
export const getBalanceSheet = () => api.get("/accounting/balance-sheet").then((r) => r.data);
export const getProfitLoss = () => api.get("/accounting/profit-loss").then((r) => r.data);

// ── Products (convenience re-export) ─────────────────────────────────────────
export const getProducts = () => api.get("/products").then((r) => r.data);

// ── Purchases ─────────────────────────────────────────────────────────────────
export const getPurchases = () => api.get("/purchases").then((r) => r.data);
export const createPurchase = (data) => api.post("/purchases", data).then((r) => r.data);

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers = () => api.get("/customers").then((r) => r.data);
export const createCustomer = (data) => api.post("/customers", data).then((r) => r.data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then((r) => r.data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);
export const getCustomerLedger = (id) => api.get(`/customers/${id}/ledger`).then((r) => r.data);

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const getSuppliers = () => api.get("/suppliers").then((r) => r.data);
export const createSupplier = (data) => api.post("/suppliers", data).then((r) => r.data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then((r) => r.data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`);
export const getSupplierLedger = (id) => api.get(`/suppliers/${id}/ledger`).then((r) => r.data);

// ── Payments ──────────────────────────────────────────────────────────────────
export const getPayments = () => api.get("/payments").then((r) => r.data);
export const createPayment = (data) => api.post("/payments", data).then((r) => r.data);
