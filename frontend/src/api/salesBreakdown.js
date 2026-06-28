import api from "./client";

export const salesBreakdownApi = {
  monthly: (year, month) => api.get("/sales-breakdown/monthly", { params: { year, month } }).then((r) => r.data),

  weekly: (year, month) => api.get("/sales-breakdown/weekly", { params: { year, month } }).then((r) => r.data),

  trend: (months = 12) => api.get("/sales-breakdown/trend", { params: { months } }).then((r) => r.data),
};
