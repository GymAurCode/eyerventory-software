import { useEffect, useState } from "react";
import { remindersApi } from "../../api/reminders";
import { Modal } from "../../components/UI";

const PRIORITIES = ["low", "medium", "high"];
const REPEATS = ["none", "daily", "weekly", "monthly"];

function toLocalDatetimeValue(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReminderForm({ reminder, onClose, onSaved }) {
  const isEdit = !!reminder;
  const [form, setForm] = useState({
    title: reminder?.title ?? "",
    description: reminder?.description ?? "",
    remind_at: toLocalDatetimeValue(reminder?.remind_at) || toLocalDatetimeValue(new Date(Date.now() + 3600000).toISOString()),
    priority: reminder?.priority ?? "medium",
    repeat: reminder?.repeat ?? "none",
    reminder_before: reminder?.reminder_before ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        remind_at: new Date(form.remind_at).toISOString(),
        reminder_before: Number(form.reminder_before),
      };
      if (isEdit) {
        await remindersApi.update(reminder.id, payload);
      } else {
        await remindersApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Reminder" : "New Reminder"} open onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Title *</label>
          <input
            className="input w-full"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Description</label>
          <textarea
            className="input w-full resize-none"
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Date & Time *</label>
            <input
              type="datetime-local"
              className="input w-full"
              value={form.remind_at}
              onChange={(e) => set("remind_at", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Remind Before (min)</label>
            <input
              type="number"
              className="input w-full"
              min={0}
              max={10080}
              value={form.reminder_before}
              onChange={(e) => set("reminder_before", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Priority</label>
            <select className="input w-full" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Repeat</label>
            <select className="input w-full" value={form.repeat} onChange={(e) => set("repeat", e.target.value)}>
              {REPEATS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
