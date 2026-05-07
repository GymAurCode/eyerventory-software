import {
  BarChart3,
  Bell,
  BookOpen,
  Insights,
  LayoutDashboard,
  Package,
  Bot,
  Settings,
  ShoppingCart,
  UserCheck,
  Users,
  Wallet,
} from "../components/icons/SidebarIcons";

// Users and Backup are now tabs inside Settings — not standalone sidebar entries.
export const SIDEBAR_ITEMS = [
  { label: "Dashboard",        route: "/",               icon: LayoutDashboard, roles: ["owner"],               color: "#6366f1", end: true  },
  { label: "Products",         route: "/products",        icon: Package,         roles: ["owner", "staff"],      color: "#f59e0b", end: true  },
  { label: "Sales",            route: "/sales",           icon: ShoppingCart,    roles: ["owner", "staff"],      color: "#10b981", end: true  },
  { label: "Expenses",         route: "/expenses",        icon: Wallet,          roles: ["owner", "staff"],      color: "#ef4444", end: true  },
  { label: "Finance",          route: "/finance",         icon: BarChart3,       roles: ["owner"],               color: "#3b82f6", end: true  },
  { label: "Accounting",       route: "/accounting",      icon: BookOpen,        roles: ["owner"],               color: "#8b5cf6", end: true  },
  { label: "Analytics",        route: "/analytics",       icon: Insights,        roles: ["owner"],               color: "#8b5cf6", end: true  },
  { label: "AI Intelligence",  route: "/ai-intelligence", icon: Bot,             roles: ["owner"],               color: "#06b6d4", end: false },
  { label: "Reminders",        route: "/reminders",       icon: Bell,            roles: ["owner", "staff"],      color: "#f97316", end: true  },
  { label: "People",           route: "/people",          icon: Users,           roles: ["owner"],               color: "#ec4899", end: false },
  { label: "HR Management",    route: "/hr",              icon: UserCheck,       roles: ["owner", "admin", "hr"],color: "#a855f7", end: true  },
  { label: "Settings",         route: "/settings",        icon: Settings,        roles: ["owner"],               color: "#94a3b8", end: false },
];
