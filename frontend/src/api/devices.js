import api from "./client";

export const devicesApi = {
  list: (params) =>
    api.get("/devices", { params }).then((r) => r.data?.data ?? r.data),
  get: (id) =>
    api.get(`/devices/${id}`).then((r) => r.data?.data ?? r.data),
  create: (payload) =>
    api.post("/devices", payload).then((r) => r.data?.data ?? r.data),
  update: (id, payload) =>
    api.put(`/devices/${id}`, payload).then((r) => r.data?.data ?? r.data),
  delete: (id) => api.delete(`/devices/${id}`),
  getTypes: () =>
    api.get("/devices/types").then((r) => r.data?.data ?? r.data),
  getStats: () =>
    api.get("/devices/stats").then((r) => r.data?.data ?? r.data),
};
