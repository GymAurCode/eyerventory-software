import { useState } from "react";
import { remindersApi } from "../api/reminders";

const PRIORITY_STYLES = {
  high: { bar: "bg-red-500", badge: "bg-red-100 text-red-700", ring: "ring-red-400" },
  medium: { bar: "bg-amber-400", badge: "bg-amber-100 text-amber-700", ring: "ring-amber-400" },
  low: { bar: "bg-blue-400", badge: "bg-blue-100 text-blue-700", ring: "ring-blue-400" },
};

const SNOOZE_OPTIONS = [5, 10, 15];

function NotificationCard({ notification, onDismiss }) {
  const { reminder } = notification;
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(false);
  const styles = PRIORITY_STYLES[reminder.priority] || PRIORITY_STYLES.medium;

  const handleSnooze = async (minutes) => {
    setLoading(`snooze-${minutes}`);
    try {
      await remindersApi.snooze(reminder.id, minutes);
      setDone(true);
      setTimeout(() => onDismiss(notification.id), 400);
    } catch (_) {
      setLoading(null);
    }
  };

  const handleComplete = async () => {
    setLoading("complete");
    try {
      await remindersApi.complete(reminder.id);
      setDone(true);
      setTimeout(() => onDismiss(notification.id), 400);
    } catch (_) {
      setLoading(null);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border shadow-2xl transition-all duration-300 ${done ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-color)",
        width: 340,
      }}
    >
      {/* Priority bar */}
      <div className={`h-1 w-full ${styles.bar}`} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles.badge}`}>
                {reminder.priority}
              </span>
              {reminder.repeat !== "none" && (
                <span className="rounded-full px-2 py-0.5 text-xs bg-[var(--surface-2,rgba(0,0,0,0.06))] text-[var(--text-muted)]">
                  ↻ {reminder.repeat}
                </span>
              )}
            </div>
            <p className="font-semibold text-sm leading-tight truncate">{reminder.title}</p>
            {reminder.description && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-2">{reminder.description}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {new Date(reminder.remind_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => onDismiss(notification.id)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none flex-shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={handleComplete}
            disabled={!!loading}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading === "complete" ? "…" : "✓ Done"}
          </button>
          {SNOOZE_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => handleSnooze(m)}
              disabled={!!loading}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold bg-[var(--surface-2,rgba(0,0,0,0.08))] text-[var(--text-primary)] hover:opacity-80 disabled:opacity-50"
            >
              {loading === `snooze-${m}` ? "…" : `+${m}m`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenter({ notifications, onDismiss, onDismissAll, connected }) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2" style={{ maxHeight: "90vh", overflowY: "auto" }}>
      {notifications.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={onDismissAll}
            className="rounded-lg px-3 py-1 text-xs bg-[var(--bg-card)] border text-[var(--text-muted)] hover:text-[var(--text-primary)] shadow"
            style={{ borderColor: "var(--border-color)" }}
          >
            Dismiss all ({notifications.length})
          </button>
        </div>
      )}
      {notifications.map((n) => (
        <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
