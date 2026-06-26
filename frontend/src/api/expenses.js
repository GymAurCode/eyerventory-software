import api from "./client";

export const expensesApi = {
  list: (params = {}) => api.get("/expenses", { params }).then((r) => r.data),
  get: (id) => api.get(`/expenses/${id}`).then((r) => r.data),
  create: (data) => api.post("/expenses", data).then((r) => r.data),
  update: (id, data) => api.put(`/expenses/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/expenses/${id}`),
  generateVoucherNo: () => api.post("/expenses/generate-voucher-no").then((r) => r.data.voucher_no),
  getExpenseTypes: () => api.get("/expenses/expense-types").then((r) => r.data),
};
