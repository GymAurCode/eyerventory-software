import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAttendanceRecords, getEmployees } from "../../api/hr";
import { DataTable, PageHeader } from "../../components/UI";

export default function AttendanceRecordsPage() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    employee_id: "",
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
  });

  useEffect(() => {
    getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = {};
    if (filters.employee_id) params.employee_id = filters.employee_id;
    if (filters.month) params.month = filters.month;
    getAttendanceRecords(params)
      .then(setRecords)
      .catch(() => toast.error("Failed to load records"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const statusBadge = (status) => {
    const map = {
      present: "bg-emerald-900/40 text-emerald-400",
      late: "bg-amber-900/40 text-amber-400",
      absent: "bg-rose-900/40 text-rose-400",
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${map[status] || map.absent}`}>
        {status}
      </span>
    );
  };

  const columns = [
    { key: "employee_name", label: "Employee" },
    { key: "date", label: "Date", render: (row) => String(row.date) },
    { key: "check_in", label: "Check In", render: (row) => row.check_in || "-" },
    { key: "check_out", label: "Check Out", render: (row) => row.check_out || "-" },
    { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
    { key: "late_minutes", label: "Late (min)", render: (row) => row.late_minutes > 0 ? `${row.late_minutes}m` : "-" },
  ];

  // Summary stats
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;

  return (
    <div>
      <PageHeader title="Attendance Records" subtitle="View and filter attendance history" />

      {/* Filters */}
      <div className="panel mb-4 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Employee</label>
          <select className="input" value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
            <option value="">All Employees</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Month</label>
          <input className="input" type="month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} />
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "Present", value: present, color: "text-emerald-400" },
          { label: "Late", value: late, color: "text-amber-400" },
          { label: "Absent", value: absent, color: "text-rose-400" },
        ].map((s) => (
          <div key={s.label} className="panel text-center">
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? <div className="panel">Loading...</div> : (
        <DataTable columns={columns} data={records} searchPlaceholder="Search records..." />
      )}
    </div>
  );
}
