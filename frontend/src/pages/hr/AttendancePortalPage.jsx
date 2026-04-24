import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkIn, checkOut, getEmployees, getTodayAttendance } from "../../api/hr";
import { PageHeader } from "../../components/UI";

export default function AttendancePortalPage() {
  const [employees, setEmployees] = useState([]);
  const [todayStatus, setTodayStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // employee_id being processed

  const load = async () => {
    setLoading(true);
    try {
      const [emps, today] = await Promise.all([getEmployees(true), getTodayAttendance()]);
      setEmployees(emps);
      setTodayStatus(today);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCheckIn = async (employee_id) => {
    setActionLoading(employee_id);
    try {
      await checkIn({ employee_id });
      toast.success("Checked in successfully");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Check-in failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async (employee_id) => {
    setActionLoading(employee_id);
    try {
      await checkOut({ employee_id });
      toast.success("Checked out successfully");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Check-out failed");
    } finally {
      setActionLoading(null);
    }
  };

  const statusMap = {};
  todayStatus.forEach((s) => { statusMap[s.employee_id] = s; });

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

  return (
    <div>
      <PageHeader title="Attendance Portal" subtitle={`Today: ${new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`} />
      {loading ? (
        <div className="panel">Loading...</div>
      ) : (
        <div className="grid gap-3">
          {employees.map((emp) => {
            const s = statusMap[emp.id];
            const isLoading = actionLoading === emp.id;
            return (
              <div key={emp.id} className="panel flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{emp.employment_type} · {emp.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                    {s?.check_in && <p>In: {s.check_in}</p>}
                    {s?.check_out && <p>Out: {s.check_out}</p>}
                    {s?.late_minutes > 0 && <p className="text-amber-400">{s.late_minutes}m late</p>}
                  </div>
                  {statusBadge(s?.status || "absent")}
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-4 py-1.5 text-sm"
                      disabled={!!s?.check_in || isLoading}
                      onClick={() => handleCheckIn(emp.id)}
                    >
                      {isLoading ? "..." : "Check In"}
                    </button>
                    <button
                      className="btn-soft px-4 py-1.5 text-sm"
                      disabled={!s?.check_in || !!s?.check_out || isLoading}
                      onClick={() => handleCheckOut(emp.id)}
                    >
                      {isLoading ? "..." : "Check Out"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="panel text-center" style={{ color: "var(--text-secondary)" }}>
              No active employees found. Add employees first.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
