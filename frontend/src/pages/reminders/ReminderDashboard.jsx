import { useEffect, useState } from "react";
import { remindersApi } from "../../api/reminders";
import { StatCard } from "../../components/UI";
import ReminderForm from "./ReminderForm";

const PRIORITY_DOT = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-blue-400" };

function ReminderRow({ reminder, onComplete, onSnooze }) {
  const isPast = new Date(reminder.remind_at) < new Date();
  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-elevated, var(--bg-card))" }}
    >
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${PRIORITY_DOT[reminder.priority] || "bg-gray-400"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{reminder.title}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {new Date(reminder.remind_at).toLocaleString()}
          {isPast && <span className="ml-2 text-red-500 font-semibold">Overdue</span>}
        </p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          onClick={() => onSnooze(reminder.id)}
          className="rounded px-2 py-1 text-xs bg-[var(--surface-2,rgba(0,0,0,0.06))] hover:opacity-80"
        >
          +5m
        </button>
        <button
          onClick={() => onComplete(reminder.id)}
          className="rounded px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}

export default function ReminderDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    remindersApi.getDashboard()
      .then((r) => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleComplete = async (id) => {
    try {
      await remindersApi.complete(id);
    } catch (_) {}
    load(); // dashboard stats need recalculating anyway
  };

  const handleSnooze = async (id) => {
    try {
      await remindersApi.snooze(id, 5);
    } catch (_) {}
    load();
  };

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Today Total" value={stats?.today_total ?? 0} tone="indigo" />
        <StatCard title="Today Completed" value={stats?.today_completed ?? 0} tone="emerald" />
        <StatCard title="Today Pending" value={stats?.today_pending ?? 0} tone="amber" />
      </div>

      {/* Quick create */}
      <div className="panel flex items-center justify-between">
        <p className="text-sm font-semibold">Quick Create Reminder</p>
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>+ New Reminder</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Upcoming 24h */}
        <section className="panel space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Upcoming (next 24h)</p>
            <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => onNavigate("reminders")}>
              View all →
            </button>
          </div>
          {stats?.upcoming_24h?.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No upcoming reminders.</p>
          ) : (
            <div className="space-y-2">
              {stats?.upcoming_24h?.map((r) => (
                <ReminderRow key={r.id} reminder={r} onComplete={handleComplete} onSnooze={handleSnooze} />
              ))}
            </div>
          )}
        </section>

        {/* Overdue */}
        <section className="panel space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-500">Overdue</p>
            <span className="text-xs text-[var(--text-muted)]">{stats?.overdue?.length ?? 0} item(s)</span>
          </div>
          {stats?.overdue?.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No overdue reminders.</p>
          ) : (
            <div className="space-y-2">
              {stats?.overdue?.map((r) => (
                <ReminderRow key={r.id} reminder={r} onComplete={handleComplete} onSnooze={handleSnooze} />
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <ReminderForm
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
