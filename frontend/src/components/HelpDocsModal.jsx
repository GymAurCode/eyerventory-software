import { useMemo, useState } from "react";
import { SHORTCUTS } from "../config/shortcuts";

const docsSections = [
  {
    title: "Overview",
    content: "This inventory platform helps you manage products, record sales, track expenses, and review financial health in one desktop workspace.",
  },
  {
    title: "Modules",
    content:
      "Products: Manage inventory items. Sales: Record product selling. Expenses: Track outgoing money. Finance: See revenue, profit, and expenses. Users: Manage staff and owners. Partners: Ownership percentage system.",
  },
  {
    title: "Important Concepts",
    content:
      "Profit is calculated as Revenue - Cost - Expenses, then donation can be deducted. Ownership percentages always total 100%. Backup and restore protect your SQLite data.",
  },
];

function markText(text, q) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q})`, "ig"));
  return parts.map((part, idx) => (part.toLowerCase() === q.toLowerCase() ? <mark key={idx} className="rounded bg-indigo-500/30 px-1">{part}</mark> : <span key={idx}>{part}</span>));
}

export default function HelpDocsModal({ open, onClose, role }) {
  const [query, setQuery] = useState("");
  const shortcutGroups = useMemo(() => {
    const entries = Object.entries(SHORTCUTS).filter(([id]) => {
      if (role !== "owner" && (id === "nav.finance" || id === "nav.users")) return false;
      return true;
    });
    return entries.reduce((acc, [id, info]) => {
      if (!acc[info.category]) acc[info.category] = [];
      acc[info.category].push({ id, ...info });
      return acc;
    }, {});
  }, [role]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <div className="flex h-[78vh] w-full max-w-4xl flex-col rounded-xl border" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <div>
            <h3 className="text-lg font-semibold">Help & Documentation</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Search docs and shortcuts</p>
          </div>
          <button className="btn-soft" onClick={onClose}>Close</button>
        </div>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <input className="input" placeholder="Search docs..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
          <div className="space-y-4 overflow-auto pr-1">
            {docsSections.map((section) => (
              <section key={section.title} className="rounded-lg border p-3" style={{ borderColor: "var(--border-color)" }}>
                <h4 className="mb-2 font-semibold">{section.title}</h4>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{markText(section.content, query.trim())}</p>
              </section>
            ))}
          </div>
          <div className="overflow-auto pr-1">
            <h4 className="mb-3 font-semibold">Shortcuts</h4>
            <div className="space-y-3">
              {Object.entries(shortcutGroups).map(([category, items]) => (
                <div key={category} className="rounded-lg border p-3" style={{ borderColor: "var(--border-color)" }}>
                  <p className="mb-2 text-sm font-medium">{category}</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: "var(--text-secondary)" }}>{item.description}</span>
                        <kbd className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--border-color)" }}>{item.combo}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
