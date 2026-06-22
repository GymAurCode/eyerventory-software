import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { NAV_SECTIONS } from "../config/navigation";

function Logo({ collapsed }) {
  return (
    <div className={`flex items-center gap-3 px-4 pt-4 pb-4 ${collapsed ? "justify-center" : ""}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5C518]">
        <i className="ti ti-eye text-[#001a1a]" style={{ fontSize: "16px" }} />
      </div>
      {!collapsed && (
        <div>
          <p className="text-xs font-semibold text-white leading-tight">EyerFlow</p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "#7ab0b0" }}>Inventory</p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label, collapsed }) {
  if (collapsed) return <div className="h-2" />;
  return (
    <p
      className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-[1.5px]"
      style={{ color: "rgba(255,255,255,0.25)" }}
    >
      {label}
    </p>
  );
}

function NavItem({ item, currentPath, searchParams, collapsed }) {
  const navigate = useNavigate();
  const route = item.route;

  const isActive = (() => {
    if (route.includes("?")) {
      const [path, qs] = route.split("?");
      const [key, val] = qs.split("=");
      return currentPath === path && searchParams.get(key) === val;
    }
    if (item.end) return currentPath === route;
    return currentPath.startsWith(route);
  })();

  return (
    <button
      onClick={() => navigate(route)}
      title={collapsed ? item.label : undefined}
      className={`group relative flex w-full items-center text-left transition-all duration-150 ${collapsed ? "justify-center px-2 py-2" : "gap-3 px-4 py-1.5"}`}
      style={{
        color: isActive ? "#F5C518" : "var(--sidebar-text)",
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = "transparent";
      }}
    >
      <i className={`ti ${item.icon}`} style={{ fontSize: "14px", color: isActive ? "#F5C518" : undefined }} />
      {!collapsed && <span className="text-[11px] font-medium flex-1">{item.label}</span>}
      {!collapsed && item.badge != null && (
        <span
          className="flex h-3.5 min-w-[16px] items-center justify-center rounded-full px-1 text-[8px] font-semibold"
          style={{
            background: isActive ? "#F5C518" : "rgba(245,197,24,0.2)",
            color: isActive ? "#001a1a" : "#F5C518",
          }}
        >
          {item.badge}
        </span>
      )}
      {isActive && (
        <span className={`absolute ${collapsed ? "right-0.5 top-0.5" : "right-2 top-1/2 -translate-y-1/2"} text-[8px]`} style={{ color: "#F5C518" }}>●</span>
      )}
    </button>
  );
}

export default function AppSidebar() {
  const { role, name } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentPath = location.hash ? location.hash.slice(1).split("?")[0] : location.pathname;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col overflow-hidden transition-all duration-200 ${collapsed ? "w-[54px]" : "w-[200px]"}`}
      style={{ background: "var(--sidebar-bg)", borderRadius: "0 12px 12px 0" }}
    >
      <Logo collapsed={collapsed} />

      <nav className="flex-1 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <SectionLabel label={section.label} collapsed={collapsed} />
            {section.items
              .filter((item) => item.roles.includes(role))
              .map((item) => (
                <NavItem
                  key={item.label + item.route}
                  item={item}
                  currentPath={currentPath}
                  searchParams={searchParams}
                  collapsed={collapsed}
                />
              ))}
          </div>
        ))}
      </nav>

      <div className={`mx-2 mb-2 mt-auto flex items-center rounded-lg px-1 py-1.5 ${collapsed ? "justify-center" : "gap-1.5 px-2"}`} style={{ background: "rgba(0,0,0,0.2)" }}>
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
          style={{ background: "#F5C518", color: "#001a1a" }}
        >
          {initials}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium text-white">{name || "User"}</p>
            <p className="truncate text-[8px]" style={{ color: "#7ab0b0" }}>{role}</p>
          </div>
        )}
      </div>

      <button
        onClick={toggle}
        className="mx-2 mb-3 flex items-center justify-center rounded-lg py-1.5 transition-colors hover:bg-[var(--sidebar-hover)]"
        style={{ color: "#7ab0b0" }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <i className={`ti ${collapsed ? "ti-chevron-right" : "ti-chevron-left"}`} style={{ fontSize: "12px" }} />
      </button>
    </aside>
  );
}
