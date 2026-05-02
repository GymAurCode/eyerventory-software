import api from "./client";

// --- Credits ---
export async function getCredits(params = {}) {
  const res = await api.get("/credits", { params });
  return res.data;
}

export async function getCreditById(id) {
  const res = await api.get(`/credits/${id}`);
  return res.data;
}

export async function createCredit(payload) {
  const res = await api.post("/credits/create", payload);
  return res.data;
}

export async function addCreditPayment(payload) {
  const res = await api.post("/credits/payment", payload);
  return res.data;
}

export async function getLedger(partyId, partyType) {
  const res = await api.get(`/credits/ledger/${partyId}`, { params: { party_type: partyType } });
  return res.data;
}

export async function getCreditSummary() {
  const res = await api.get("/reports/credit-summary");
  return res.data;
}

// --- Suppliers (Credit module) ---
export async function getSuppliers() {
  const res = await api.get("/suppliers");
  return res.data;
}

export async function createSupplier(payload) {
  const res = await api.post("/suppliers", payload);
  return res.data;
}

export async function updateSupplier(id, payload) {
  const res = await api.put(`/suppliers/${id}`, payload);
  return res.data;
}

export async function deleteSupplier(id) {
  await api.delete(`/suppliers/${id}`);
}

// --- Customers (Credit module) ---
export async function getCustomers() {
  const res = await api.get("/customers");
  return res.data;
}

export async function createCustomer(payload) {
  const res = await api.post("/customers", payload);
  return res.data;
}

export async function updateCustomer(id, payload) {
  const res = await api.put(`/customers/${id}`, payload);
  return res.data;
}

export async function deleteCustomer(id) {
  await api.delete(`/customers/${id}`);
}
