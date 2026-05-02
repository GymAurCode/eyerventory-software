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
<<<<<<< HEAD
  const isDark = theme === "dark";

  return (
    <aside
      className="sticky top-0 h-screen shrink-0 overflow-y-auto overflow-x-hidden flex-col border-r px-2 py-3 transition-all duration-300"
      style={{
        display: "flex",
        width: collapsed ? "56px" : "200px",
=======

  return (
    <aside
      className="flex h-screen flex-col border-r transition-all duration-300"
      style={{
        width: collapsed ? "60px" : "232px",
        minWidth: collapsed ? "60px" : "232px",
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
        borderColor: "var(--border-color)",
        background: "var(--bg-card)",
      }}
    >
      {/* Header */}
<<<<<<< HEAD
      <div className={`mb-4 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <p className="truncate text-sm font-semibold leading-tight" style={{ maxWidth: "130px" }}>
=======
      <div
        className={`flex shrink-0 items-center border-b py-3 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}
        style={{ borderColor: "var(--border-color)" }}
      >
        {!collapsed && (
          <p className="truncate text-sm font-semibold" style={{ maxWidth: "140px" }}>
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
            {companyName}
          </p>
        )}
        <button
<<<<<<< HEAD
          className="btn-soft h-7 w-7 shrink-0 p-0"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MenuIcon size={14} />
=======
          className="btn-soft h-8 w-8 shrink-0 p-0"
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <MenuIcon size={15} />
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
        </button>
      </div>

      {/* Nav items */}
<<<<<<< HEAD
      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const iconColor = item.color || "var(--text-secondary)";

          return (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.end ?? true}
              title={item.label}
              className={`group flex items-center rounded-md border transition-all duration-200 ${
                collapsed ? "justify-center px-0 py-1.5" : "gap-2 px-2 py-1.5"
              }`}
              style={({ isActive }) => {
                if (!isActive) {
                  return {
                    color: "var(--text-secondary)",
                    background: "transparent",
                    borderColor: "transparent",
                  };
                }
                if (isDark) {
                  return {
                    color: "#ffffff",
                    background: `color-mix(in srgb, ${iconColor} 22%, var(--bg-card))`,
                    borderColor: `color-mix(in srgb, ${iconColor} 50%, var(--border-color))`,
                  };
                }
                return {
                  color: iconColor,
                  background: `color-mix(in srgb, ${iconColor} 10%, transparent)`,
                  borderColor: iconColor,
                };
              }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-all duration-200"
                    style={
                      isActive && isDark
                        ? { color: "#ffffff", background: "transparent" }
                        : {
                            color: iconColor,
                            background: `color-mix(in srgb, ${iconColor} 14%, transparent)`,
                          }
                    }
                  >
                    <Icon size={13} strokeWidth={2} />
                  </span>

                  {!collapsed && (
                    <span
                      className="truncate text-xs font-medium leading-tight"
                      style={isActive && !isDark ? { color: iconColor } : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto pt-3 text-center" style={{ color: "var(--text-secondary)", fontSize: "10px" }}>
        {!collapsed && "Powered by Eyercall"}
      </div>
=======
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
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
    </aside>
  );
}
