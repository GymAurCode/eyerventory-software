import { useEffect, useState } from "react";
import { remindersApi } from "../../api/reminders";
import { ConfirmDialog, Modal } from "../../components/UI";

const PRIORITIES = ["low", "medium", "high"];
const REPEATS = ["none", "daily", "weekly", "monthly"];

function TemplateForm({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    title_template: "",
    description_template: "",
    priority: "medium",
    repeat: "none",
    reminder_before: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await remindersApi.createTemplate({ ...form, reminder_before: Number(form.reminder_before) });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Template" open onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Template Name *</label>
          <input className="input w-full" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Title Template *
            <span className="ml-2 text-[var(--text-muted)] font-normal">Use {"{{variable}}"} for dynamic values</span>
          </label>
          <input className="input w-full" value={form.title_template} onChange={(e) => set("title_template", e.target.value)} required maxLength={200} placeholder="e.g. Restock {{product}} by {{date}}" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Description Template</label>
          <textarea className="input w-full resize-none" rows={2} value={form.description_template} onChange={(e) => set("description_template", e.target.value)} placeholder="e.g. Order {{quantity}} units from {{supplier}}" />
        </div>
        <div className="grid grid-cols-3 gap-3">
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
          <div>
            <label className="block text-xs font-medium mb-1">Before (min)</label>
            <input type="number" className="input w-full" min={0} max={10080} value={form.reminder_before} onChange={(e) => set("reminder_before", e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ApplyTemplateModal({ template, onClose, onSaved }) {
  const [remindAt, setRemindAt] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [vars, setVars] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Extract variable names from template
  const varNames = [...new Set([
    ...(template.title_template.match(/\{\{([^}]+)\}\}/g) || []),
    ...((template.description_template || "").match(/\{\{([^}]+)\}\}/g) || []),
  ])].map((m) => m.slice(2, -2).trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await remindersApi.applyTemplate(template.id, {
        remind_at: new Date(remindAt).toISOString(),
        variables: vars,
      });
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to apply template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Apply: ${template.name}`} open onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Date & Time *</label>
          <input type="datetime-local" className="input w-full" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} required />
        </div>
        {varNames.map((v) => (
          <div key={v}>
            <label className="block text-xs font-medium mb-1">{v}</label>
            <input className="input w-full" value={vars[v] || ""} onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))} placeholder={`Value for {{${v}}}`} />
          </div>
        ))}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Reminder"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    remindersApi.listTemplates().then((r) => setTemplates(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    setDeleting(true);
    await remindersApi.deleteTemplate(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>+ New Template</button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="panel text-sm text-[var(--text-muted)]">
          No templates yet. Create reusable reminder templates with dynamic variables like {"{{product}}"}, {"{{date}}"}.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="panel space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{t.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                  t.priority === "high" ? "bg-red-100 text-red-700" : t.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                }`}>{t.priority}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">{t.title_template}</p>
              {t.description_template && (
                <p className="text-xs text-[var(--text-muted)] truncate">{t.description_template}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>↻ {t.repeat}</span>
                {t.reminder_before > 0 && <span>-{t.reminder_before}m</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <button className="btn-primary text-xs flex-1" onClick={() => setApplyTarget(t)}>Use Template</button>
                <button className="btn-soft text-xs text-red-500" onClick={() => setDeleteTarget(t)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <TemplateForm onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {applyTarget && <ApplyTemplateModal template={applyTarget} onClose={() => setApplyTarget(null)} onSaved={() => { setApplyTarget(null); load(); }} />}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Template"
        description={`Delete template "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
