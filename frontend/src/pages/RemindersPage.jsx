import { useEffect, useState } from "react";
import { remindersApi } from "../api/reminders";
import { Modal, PageHeader } from "../components/UI";
import ReminderDashboard from "./reminders/ReminderDashboard";
import MyReminders from "./reminders/MyReminders";
import TemplatesPage from "./reminders/TemplatesPage";
import NotificationLogs from "./reminders/NotificationLogs";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "reminders", label: "My Reminders" },
  { id: "templates", label: "Templates" },
  { id: "logs", label: "Notification Logs" },
];

export default function RemindersPage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reminders & Notifications"
        subtitle="Schedule reminders, get real-time alerts, and track notification history."
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)", width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <ReminderDashboard onNavigate={setTab} />}
      {tab === "reminders" && <MyReminders />}
      {tab === "templates" && <TemplatesPage />}
      {tab === "logs" && <NotificationLogs />}
    </div>
  );
}
