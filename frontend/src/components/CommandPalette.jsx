import { useMemo, useState } from "react";
import { formatShortcut } from "../config/shortcuts";

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((item) => item.label.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/55 p-6 pt-20" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="border-b p-3" style={{ borderColor: "var(--border-color)" }}>
          <input autoFocus className="input" placeholder="Search commands..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="max-h-[420px] overflow-auto p-2">
          {visible.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left"
              style={{ background: "transparent" }}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <span>{item.label}</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatShortcut(item.actionId)}</span>
            </button>
          ))}
          {visible.length === 0 && <p className="px-3 py-4 text-sm" style={{ color: "var(--text-secondary)" }}>No commands found.</p>}
        </div>
      </div>
    </div>
  );
}
