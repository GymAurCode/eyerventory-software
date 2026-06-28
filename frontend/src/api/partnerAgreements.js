import api from "./client";

export const partnerAgreementApi = {
  listByUser: (userId) => api.get(`/partner-agreements/user/${userId}`).then((r) => r.data),

  listAll: () => api.get("/partner-agreements").then((r) => r.data),

  create: (data) => api.post("/partner-agreements", data).then((r) => r.data),

  get: (id) => api.get(`/partner-agreements/${id}`).then((r) => r.data),

  update: (id, data) => api.put(`/partner-agreements/${id}`, data).then((r) => r.data),
};
