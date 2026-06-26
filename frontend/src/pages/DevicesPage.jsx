import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X } from "lucide-react";
import api from "../api/client";
import { PageHeader, DataTable, LoadingSkeleton, EmptyState } from "../components/UI";
import { useTheme } from "../contexts/ThemeContext";

const DEVICE_TYPE_LABELS = {
  receipt_printer: "Receipt Printer",
  barcode_scanner: "Barcode Scanner",
  cash_drawer: "Cash Drawer",
  thermal_printer: "Thermal Printer",
  label_printer: "Label Printer",
  customer_display: "Customer Display",
  card_payment_terminal: "Card Payment Terminal",
  qr_payment_device: "QR Payment Device",
  weighing_scale: "Weighing Scale",
  fingerprint_device: "Fingerprint Device",
  rfid_reader: "RFID Reader",
  network_pos_device: "Network POS Device",
};

const STATUS_CONFIG = {
  connected: { label: "Connected", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  disconnected: { label: "Disconnected", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  unknown: { label: "Unknown", color: "#eab308", bg: "rgba(234,179,8,0.12)" },
};

const RECOMMENDED_DEVICES = [
  {
    category: "receipt_printer",
    label: "Receipt Printer",
    icon: "ti-printer",
    models: ["Epson TM-T82III", "Epson TM-T20III", "XPrinter XP-Q200"],
    useFor: "Printing customer receipts.",
  },
  {
    category: "barcode_scanner",
    label: "Barcode Scanner",
    icon: "ti-scan",
    models: ["Honeywell Voyager 1250g", "Zebra DS2208", "Netum NT-1228BL"],
    useFor: "Fast barcode scanning during sales.",
  },
  {
    category: "cash_drawer",
    label: "Cash Drawer",
    icon: "ti-safe",
    models: ["APG Cash Drawer", "POS-X Cash Drawer"],
    useFor: "Secure cash handling.",
  },
  {
    category: "thermal_printer",
    label: "Thermal Printer",
    icon: "ti-printer",
    models: ["Star TSP143III", "Bixolon SRP-275"],
    useFor: "High-speed thermal receipt printing.",
  },
  {
    category: "label_printer",
    label: "Label Printer",
    icon: "ti-tag",
    models: ["Brother QL-820NWB", "Zebra GK420d"],
    useFor: "Printing product labels and barcode tags.",
  },
  {
    category: "customer_display",
    label: "Customer Display Screen",
    icon: "ti-monitor",
    models: ["Epson DM-D30", "Partner Tech PD-3210"],
    useFor: "Showing transaction details to customers.",
  },
  {
    category: "card_payment_terminal",
    label: "Card Payment Terminal",
    icon: "ti-credit-card",
    models: ["Verifone V200c", "Ingenico Move 5000"],
    useFor: "Card and digital payments.",
  },
  {
    category: "qr_payment_device",
    label: "QR Payment Device",
    icon: "ti-qrcode",
    models: ["SumUp Air", "Square Reader"],
    useFor: "QR code and contactless payments.",
  },
  {
    category: "weighing_scale",
    label: "Weighing Scale",
    icon: "ti-scale",
    models: ["CAS PD-15", "Dibal G-Master"],
    useFor: "Weighing items for price calculation.",
  },
  {
    category: "fingerprint_device",
    label: "Fingerprint Device",
    icon: "ti-fingerprint",
    models: ["ZKTeco ZK-4500", "DigitalPersona 4500"],
    useFor: "Biometric employee authentication.",
  },
  {
    category: "rfid_reader",
    label: "RFID Reader",
    icon: "ti-antenna-bars-5",
    models: ["Zebra FX9600", "Impinj R700"],
    useFor: "RFID tag scanning for inventory.",
  },
  {
    category: "network_pos_device",
    label: "Network POS Device",
    icon: "ti-server",
    models: ["POS-X EVO", "Sunmi V2s"],
    useFor: "All-in-one network-connected POS terminal.",
  },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: cfg.color, boxShadow: `0 0 4px ${cfg.color}` }}
      />
      {cfg.label}
    </span>
  );
}

function formatLastSeen(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString();
}

function DeviceCard({ device, onView }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 transition-all hover:shadow-md"
      style={{
        borderColor: "var(--border-color)",
        background: isDark ? "#0d2020" : "#ffffff",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{device.name}</h3>
            <StatusBadge status={device.status} />
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {DEVICE_TYPE_LABELS[device.device_type] || device.device_type}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {device.model && (
          <div>
            <span className="font-medium">Model:</span> {device.model}
          </div>
        )}
        <div>
          <span className="font-medium">Last Seen:</span> {formatLastSeen(device.last_connected_at)}
        </div>
        {device.assigned_pos_terminal && (
          <div>
            <span className="font-medium">Terminal:</span> {device.assigned_pos_terminal}
          </div>
        )}
        {device.location_branch && (
          <div>
            <span className="font-medium">Branch:</span> {device.location_branch}
          </div>
        )}
        {device.connection_method && (
          <div>
            <span className="font-medium">Connection:</span> {device.connection_method}
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors"
          style={{
            background: "var(--bg-hover)",
            color: "var(--text-primary)",
          }}
          onClick={() => onView(device)}
        >
          View Details
        </button>
      </div>
    </motion.div>
  );
}

function DeviceDetailModal({ device, open, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !device) return null;

  const fields = [
    { label: "Device Name", value: device.name },
    { label: "Device Type", value: DEVICE_TYPE_LABELS[device.device_type] || device.device_type },
    { label: "Status", value: null, badge: device.status },
    { label: "Model", value: device.model || "—" },
    { label: "Serial Number", value: device.serial_number || "—" },
    { label: "Firmware Version", value: device.firmware_version || "—" },
    { label: "Connection Type", value: device.connection_type || "—" },
    { label: "Connection Method", value: device.connection_method || "—" },
    { label: "Signal Strength", value: device.signal_strength != null ? `${device.signal_strength}%` : "—" },
    { label: "Driver Status", value: device.driver_status || "—" },
    { label: "Assigned POS Terminal", value: device.assigned_pos_terminal || "—" },
    { label: "Location / Branch", value: device.location_branch || "—" },
    { label: "Last Connected", value: device.last_connected_at ? new Date(device.last_connected_at).toLocaleString() : "—" },
    { label: "Last Activity", value: device.last_activity_at ? new Date(device.last_activity_at).toLocaleString() : "—" },
    { label: "Error Message", value: device.error_message || "—" },
    { label: "Notes", value: device.notes || "—" },
  ];

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4">
      <div
        className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
        style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Device Details</h3>
            <StatusBadge status={device.status} />
          </div>
          <button onClick={onClose} className="btn-soft px-3 py-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                {f.label}
              </p>
              {f.badge ? (
                <div className="mt-0.5"><StatusBadge status={f.badge} /></div>
              ) : (
                <p
                  className="mt-0.5 text-sm"
                  style={{
                    color: f.value === "—" ? "var(--text-secondary)" : "var(--text-primary)",
                  }}
                >
                  {f.value}
                </p>
              )}
            </div>
          ))}
        </div>
        {device.signal_strength != null && (
          <div className="mt-5">
            <p className="mb-1.5 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Signal Strength
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-hover)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${device.signal_strength}%`,
                  background:
                    device.signal_strength > 70
                      ? "#22c55e"
                      : device.signal_strength > 30
                        ? "#eab308"
                        : "#ef4444",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendedSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recommended Devices"
        subtitle="Curated hardware recommendations for each POS function"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {RECOMMENDED_DEVICES.map((rec) => (
          <motion.div
            key={rec.category}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4 transition-all"
            style={{
              borderColor: "var(--border-color)",
              background: isDark ? "#0d2020" : "#ffffff",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "rgba(0,128,128,0.12)" }}
              >
                <i className={`ti ${rec.icon}`} style={{ fontSize: "16px", color: "#008080" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{rec.label}</h3>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {rec.useFor}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {rec.models.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]"
                  style={{ background: isDark ? "rgba(0,128,128,0.08)" : "#f0fafa" }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: "#008080" }}
                  />
                  {m}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, connected: 0, disconnected: 0, unknown: 0 });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("devices");

  const load = async () => {
    try {
      const params = {};
      if (filterType) params.device_type = filterType;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get("/devices", { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setDevices(data);
    } catch {
      // backend may not be ready
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/devices/stats");
      setStats(res.data);
    } catch {
      // backend may not be ready
    }
  };

  useEffect(() => {
    load();
    loadStats();
  }, [filterType, filterStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      load();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [filterType, filterStatus]);

  const filteredDevices = devices.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (DEVICE_TYPE_LABELS[d.device_type] || d.device_type).toLowerCase().includes(q) ||
      (d.model || "").toLowerCase().includes(q) ||
      (d.assigned_pos_terminal || "").toLowerCase().includes(q) ||
      (d.location_branch || "").toLowerCase().includes(q)
    );
  });

  const deviceTypes = Object.keys(DEVICE_TYPE_LABELS);

  return (
    <div className="space-y-4">
      <PageHeader title="Devices" subtitle="Monitor and manage all POS hardware devices" />

      <div className="grid gap-3 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--border-color)",
            background: isDark ? "#0d2020" : "#ffffff",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.12)" }}>
              <i className="ti ti-device-desktop" style={{ fontSize: "18px", color: "#6366f1" }} />
            </div>
            <div>
              <p className="text-lg font-semibold">{stats.total}</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Total Devices</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--border-color)",
            background: isDark ? "#0d2020" : "#ffffff",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(34,197,94,0.12)" }}>
              <i className="ti ti-plug-connected" style={{ fontSize: "18px", color: "#22c55e" }} />
            </div>
            <div>
              <p className="text-lg font-semibold">{stats.connected}</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Connected</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--border-color)",
            background: isDark ? "#0d2020" : "#ffffff",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(239,68,68,0.12)" }}>
              <i className="ti ti-plug-off" style={{ fontSize: "18px", color: "#ef4444" }} />
            </div>
            <div>
              <p className="text-lg font-semibold">{stats.disconnected}</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Disconnected</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--border-color)",
            background: isDark ? "#0d2020" : "#ffffff",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(234,179,8,0.12)" }}>
              <i className="ti ti-help-circle" style={{ fontSize: "18px", color: "#eab308" }} />
            </div>
            <div>
              <p className="text-lg font-semibold">{stats.unknown}</p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Unknown</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "devices" ? "shadow-sm" : ""
          }`}
          style={{
            background: activeTab === "devices" ? (isDark ? "#1a3535" : "#e8f0f0") : "transparent",
            color: activeTab === "devices" ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          onClick={() => setActiveTab("devices")}
        >
          All Devices
        </button>
        <button
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "recommended" ? "shadow-sm" : ""
          }`}
          style={{
            background: activeTab === "recommended" ? (isDark ? "#1a3535" : "#e8f0f0") : "transparent",
            color: activeTab === "recommended" ? "var(--text-primary)" : "var(--text-secondary)",
          }}
          onClick={() => setActiveTab("recommended")}
        >
          Recommended Devices
        </button>
      </div>

      {activeTab === "devices" && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <i
                className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2"
                style={{ fontSize: "14px", color: "var(--text-secondary)" }}
              />
              <input
                className="input pl-9"
                placeholder="Search devices by name, type, model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input w-44"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">All Types</option>
              {deviceTypes.map((t) => (
                <option key={t} value={t}>
                  {DEVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              className="input w-40"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton rows={6} />
          ) : filteredDevices.length === 0 ? (
            <EmptyState title="No Devices Found" description={devices.length === 0 ? "Register a device to start monitoring." : "Try adjusting your search or filters."} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onView={(d) => {
                    setSelectedDevice(d);
                    setViewOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "recommended" && <RecommendedSection />}

      <DeviceDetailModal
        device={selectedDevice}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setSelectedDevice(null);
        }}
      />
    </div>
  );
}
