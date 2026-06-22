import { useEffect, useState } from "react";
import { remindersApi } from "../../api/reminders";
import { ConfirmDialog } from "../../components/UI";
import ReminderForm from "./ReminderForm";

const FILTERS = [
  { value: "", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

const PRIORITY_BADGE = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

const STATUS_BADGE = {
  pending: "bg-[var(--surface-2,rgba(0,0,0,0.06))] text-[var(--text-muted)]",
  completed: "bg-green-100 text-green-700",
  snoozed: "bg-purple-100 text-purple-700",
};

export default function MyReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [editTarget, setEditTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    remindersApi.list({ filter_by: filter || undefined, search: search || undefined })
      .then((r) => setReminders(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter, search]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === reminders.length) setSelected(new Set());
    else setSelected(new Set(reminders.map((r) => r.id)));
  };

  const handleBulk = async (action) => {
    if (selected.size === 0) return;
    await remindersApi.bulk([...selected], action);
    setSelected(new Set());
    load();
  };

  const handleDelete = async () => {
    setDeleting(true);
    await remindersApi.remove(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const handleComplete = async (id) => {
    try {
      const { data: updated } = await remindersApi.complete(id);
      // Replace the row in-place — no re-fetch, no duplicate
      setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      load(); // fallback
    }
  };

  const handleSnooze = async (id, minutes) => {
    try {
      const { data: updated } = await remindersApi.snooze(id, minutes);
      setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-56"
          placeholder="Search reminders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-2,rgba(0,0,0,0.06))] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {selected.size > 0 && (
            <>
              <button className="btn-soft text-xs" onClick={() => handleBulk("complete")}>
                ✓ Complete ({selected.size})
              </button>
              <button className="btn-soft text-xs text-red-500" onClick={() => handleBulk("delete")}>
                Delete ({selected.size})
              </button>
            </>
          )}
          <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>+ New</button>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-auto p-0">
        {loading ? (
          <p className="p-4 text-sm text-[var(--text-muted)]">Loading…</p>
        ) : reminders.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-muted)]">No reminders found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border-color)" }}>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={selected.size === reminders.length && reminders.length > 0} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Repeat</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-[var(--surface-2,rgba(0,0,0,0.03))]" style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.title}</p>
                    {r.description && <p className="text-xs text-[var(--text-muted)] truncate max-w-xs">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(r.remind_at).toLocaleString()}
                    {r.reminder_before > 0 && (
                      <span className="ml-1 text-[var(--text-muted)]">(-{r.reminder_before}m)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PRIORITY_BADGE[r.priority] || ""}`}>
                      {r.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{r.repeat}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status] || ""}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.status === "pending" && (
                        <>
                          <button className="icon-btn icon-btn-view" onClick={() => handleComplete(r.id)} title="Mark Done">
                            <i className="ti ti-check" style={{ fontSize: "16px" }} />
                          </button>
                          <button className="icon-btn" onClick={() => handleSnooze(r.id, 5)} title="Snooze 5m">
                            <i className="ti ti-clock" style={{ fontSize: "16px" }} />
                          </button>
                        </>
                      )}
                      <button className="icon-btn icon-btn-edit" onClick={() => setEditTarget(r)} title="Edit">
                        <i className="ti ti-edit" style={{ fontSize: "16px" }} />
                      </button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(r)} title="Delete">
                        <i className="ti ti-trash" style={{ fontSize: "16px" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <ReminderForm onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {editTarget && (
        <ReminderForm reminder={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Reminder"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
