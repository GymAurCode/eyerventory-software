import { useEffect, useState } from "react";
import { remindersApi } from "../../api/reminders";

const STATUS_BADGE = {
  delivered: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-700",
  failed: "bg-gray-100 text-gray-600",
};

const ACTION_BADGE = {
  completed: "bg-green-100 text-green-700",
  snoozed: "bg-purple-100 text-purple-700",
  ignored: "bg-gray-100 text-gray-500",
};

const PRIORITY_DOT = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-blue-400" };

export default function NotificationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    setLoading(true);
    remindersApi.getLogs({ search: search || undefined, status: statusFilter || undefined })
      .then((r) => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const handleExport = async () => {
    try {
      const res = await remindersApi.exportLogs();
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notification_logs.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — user will see nothing downloaded
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-56"
          placeholder="Search by reminder title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="delivered">Delivered</option>
          <option value="missed">Missed</option>
          <option value="failed">Failed</option>
        </select>
        <button className="btn-soft text-sm ml-auto" onClick={handleExport}>
          ↓ Export CSV
        </button>
      </div>

      <div className="panel overflow-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-[var(--text-muted)]">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-muted)]">No notification logs found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
                <th className="px-4 py-3 font-semibold">Reminder</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Triggered At</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">User Action</th>
                <th className="px-4 py-3 font-semibold">Snooze</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-[var(--surface-2,rgba(0,0,0,0.03))]" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{log.reminder_title}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[log.reminder_priority] || "bg-gray-400"}`} />
                      <span className="capitalize text-xs">{log.reminder_priority}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(log.triggered_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[log.status] || ""}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.user_action ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ACTION_BADGE[log.user_action] || ""}`}>
                        {log.user_action}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {log.snooze_minutes ? `${log.snooze_minutes}m` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
