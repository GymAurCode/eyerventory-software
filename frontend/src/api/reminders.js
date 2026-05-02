import api from "./client";

const BASE = "/reminders";

export const remindersApi = {
  // Dashboard
  getDashboard: () => api.get(`${BASE}/dashboard`),

  // Reminders CRUD
  list: (params = {}) => api.get(BASE, { params }),
  get: (id) => api.get(`${BASE}/${id}`),
  create: (data) => api.post(BASE, data),
  update: (id, data) => api.put(`${BASE}/${id}`, data),
  remove: (id) => api.delete(`${BASE}/${id}`),
  snooze: (id, minutes) => api.post(`${BASE}/${id}/snooze`, { minutes }),
  complete: (id) => api.post(`${BASE}/${id}/complete`),
  bulk: (ids, action) => api.post(`${BASE}/bulk`, { ids, action }),

  // Templates
  listTemplates: () => api.get(`${BASE}/templates/list`),
  createTemplate: (data) => api.post(`${BASE}/templates`, data),
  deleteTemplate: (id) => api.delete(`${BASE}/templates/${id}`),
  applyTemplate: (id, data) => api.post(`${BASE}/templates/${id}/apply`, data),

  // Logs
  getLogs: (params = {}) => api.get(`${BASE}/notifications/logs`, { params }),
  exportLogs: () => api.get(`${BASE}/notifications/logs/export`, { responseType: "blob" }),
};
