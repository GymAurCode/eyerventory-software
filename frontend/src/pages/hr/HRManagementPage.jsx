import { useState } from "react";
import AttendancePortalPage from "./AttendancePortalPage";
import AttendanceRecordsPage from "./AttendanceRecordsPage";
import EmployeesPage from "./EmployeesPage";
import HRPaymentsPage from "./HRPaymentsPage";
import LeavesPage from "./LeavesPage";
import PayrollPage from "./PayrollPage";

const TABS = [
  { id: "employees",           label: "Employees" },
  { id: "attendance",          label: "Attendance" },
  { id: "attendance-records",  label: "Att. Records" },
  { id: "payroll",             label: "Payroll" },
  { id: "hr-payments",         label: "HR Payments" },
  { id: "leaves",              label: "Leaves" },
];

const TAB_CONTENT = {
  "employees":           <EmployeesPage />,
  "attendance":          <AttendancePortalPage />,
  "attendance-records":  <AttendanceRecordsPage />,
  "payroll":             <PayrollPage />,
  "hr-payments":         <HRPaymentsPage />,
  "leaves":              <LeavesPage />,
};

export default function HRManagementPage() {
  const [activeTab, setActiveTab] = useState("employees");

  return (
    <div>
      {/* Module header */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold">HR Management</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Employees, attendance, payroll, payments and leave — all in one place
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-xl border p-1"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150"
              style={
                isActive
                  ? {
                      background: "var(--accent)",
                      color: "#ffffff",
                      boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                    }
                  : {
                      color: "var(--text-secondary)",
                      background: "transparent",
                    }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div key={activeTab}>
        {TAB_CONTENT[activeTab]}
      </div>
    </div>
  );
}
