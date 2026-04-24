/**
 * HR Module API client
 * All calls go through the shared axios instance (auth token auto-attached).
 */
import api from "./client";

// ─── Employees ───────────────────────────────────────────────────────────────
export const getEmployees = (activeOnly = false) =>
  api.get("/employees", { params: { active_only: activeOnly } }).then((r) => r.data);

export const createEmployee = (data) =>
  api.post("/employees", data).then((r) => r.data);

export const updateEmployee = (id, data) =>
  api.put(`/employees/${id}`, data).then((r) => r.data);

// ─── Attendance ───────────────────────────────────────────────────────────────
export const checkIn = (data) =>
  api.post("/attendance/check-in", data).then((r) => r.data);

export const checkOut = (data) =>
  api.post("/attendance/check-out", data).then((r) => r.data);

export const getTodayAttendance = () =>
  api.get("/attendance/today").then((r) => r.data);

export const getAttendanceRecords = (params = {}) =>
  api.get("/attendance", { params }).then((r) => r.data);

// ─── Leaves ───────────────────────────────────────────────────────────────────
export const getLeaves = (params = {}) =>
  api.get("/leaves", { params }).then((r) => r.data);

export const createLeave = (data) =>
  api.post("/leaves", data).then((r) => r.data);

export const approveLeave = (id, data) =>
  api.put(`/leaves/${id}/approve`, data).then((r) => r.data);

// ─── Payroll ──────────────────────────────────────────────────────────────────
export const getPayrolls = (params = {}) =>
  api.get("/payroll", { params }).then((r) => r.data);

export const generatePayroll = (data) =>
  api.post("/payroll/generate", data).then((r) => r.data);

// ─── HR Payments ──────────────────────────────────────────────────────────────
export const getHRPayments = (params = {}) =>
  api.get("/hr-payments", { params }).then((r) => r.data);

export const createHRPayment = (data) =>
  api.post("/hr-payments", data).then((r) => r.data);

export const reversePayment = (data) =>
  api.post("/hr-payments/reverse", data).then((r) => r.data);
