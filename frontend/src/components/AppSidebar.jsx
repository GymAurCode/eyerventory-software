import { NavLink } from "react-router-dom";
import { MenuIcon } from "./icons/SidebarIcons";
import { useTheme } from "../contexts/ThemeContext";

function navItemStyle(isActive, theme, color) {
  if (!isActive) {
    // text always uses CSS var so it respects dark/light
    return { background: "transparent", borderColor: "transparent" };
  }
  if (theme === "dark") {
    return {
      background: `color-mix(in srgb, ${color} 22%, var(--bg-card))`,
      borderColor: `color-mix(in srgb, ${color} 45%, var(--border-color))`,
    };
  }
  return {
    background: `color-mix(in srgb, ${color} 10%, var(--bg-card))`,
    borderColor: color,
  };
}

export default function AppSidebar({ collapsed, onToggle, items, companyName }) {
  const { theme } = useTheme();

  return (
    <aside
      className="flex h-screen flex-col border-r transition-all duration-300"
      style={{
        width: collapsed ? "60px" : "232px",
        minWidth: collapsed ? "60px" : "232px",
        borderColor: "var(--border-color)",
        background: "var(--bg-card)",
      }}
    >
      {/* Header */}
      <div
        className={`flex shrink-0 items-center border-b py-3 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}
        style={{ borderColor: "var(--border-color)" }}
      >
        {!collapsed && (
          <p className="truncate text-sm font-semibold" style={{ maxWidth: "140px" }}>
            {companyName}
          </p>
        )}
        <button
          className="btn-soft h-8 w-8 shrink-0 p-0"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MenuIcon size={15} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-1.5 py-2" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const color = item.color || "#6366F1";

            return (
              <NavLink
                key={item.route}
                to={item.route}
                title={item.label}
                className={`flex items-center rounded-md border transition-all duration-150 ${
                  collapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2 py-1.5"
                }`}
                style={({ isActive }) => navItemStyle(isActive, theme, color)}
              >
                {/* Colored icon box */}
                <span
                  className="flex shrink-0 items-center justify-center rounded-md"
                  style={{
                    width: "30px",
                    height: "30px",
                    background: `color-mix(in srgb, ${color} 18%, var(--bg-card))`,
                    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                    color: color,
                  }}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>

                {/* Label — always theme text color, not icon color */}
                {!collapsed && (
                  <span
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <p
          className="shrink-0 border-t py-2 text-center text-[10px]"
          style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          Powered by Eyercall
        </p>
      )}
    </aside>
  );
}
