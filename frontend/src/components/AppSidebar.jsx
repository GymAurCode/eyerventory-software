import { NavLink } from "react-router-dom";
import { MenuIcon } from "./icons/SidebarIcons";

export default function AppSidebar({ collapsed, onToggle, items, companyName }) {
  return (
    <aside
      className="flex flex-col border-r px-3 py-4 transition-all duration-300"
      style={{ width: collapsed ? "72px" : "240px", borderColor: "var(--border-color)", background: "var(--bg-card)" }}
    >
      <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <p className="truncate text-lg font-semibold">{companyName}</p>}
        <button className="btn-soft h-9 w-9 p-0" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <MenuIcon size={18} />
        </button>
      </div>
      <nav className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.route}
              to={item.route}
              title={collapsed ? item.label : ""}
              className={({ isActive }) =>
                `group flex items-center rounded-lg border transition-all duration-200 ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} ${
                  isActive ? "text-white" : ""
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "#ffffff" : "var(--text-secondary)",
                background: isActive ? "color-mix(in srgb, var(--accent) 28%, var(--bg-card))" : "transparent",
                borderColor: isActive ? "color-mix(in srgb, var(--accent) 45%, var(--border-color))" : "transparent",
              })}
            >
              <Icon size={18} strokeWidth={1.9} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
        {!collapsed && "Powered by Eyercall"}
      </div>
    </aside>
  );
}
