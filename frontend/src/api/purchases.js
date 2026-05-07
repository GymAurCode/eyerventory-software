import api from "./client";

export const purchasesApi = {
  list: () => api.get("/purchases").then((r) => r.data?.data ?? r.data),
  get: (id) => api.get(`/purchases/${id}`).then((r) => r.data?.data ?? r.data),
  create: (payload) => api.post("/purchases", payload).then((r) => r.data?.data ?? r.data),
  delete: (id) => api.delete(`/purchases/${id}`),
};
