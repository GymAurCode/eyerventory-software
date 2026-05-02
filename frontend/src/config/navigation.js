import {
  BarChart3,
  Brain,
  DollarSign,
  Insights,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  UserCheck,
  Wallet,
} from "../components/icons/SidebarIcons";

// Users and Backup are now tabs inside Settings — not standalone sidebar entries.
export const SIDEBAR_ITEMS = [
  { label: "Dashboard",         route: "/",                    icon: LayoutDashboard, roles: ["owner"],              color: "#6366F1" },
  { label: "Products",          route: "/products",            icon: Package,         roles: ["owner", "staff"],     color: "#22C55E" },
  { label: "Sales",             route: "/sales",               icon: ShoppingCart,    roles: ["owner", "staff"],     color: "#06B6D4" },
  { label: "Expenses",          route: "/expenses",            icon: Wallet,          roles: ["owner", "staff"],     color: "#F59E0B" },
  { label: "Finance",           route: "/finance",             icon: BarChart3,       roles: ["owner"],              color: "#10B981" },
  { label: "Payments",          route: "/accounting/payments", icon: DollarSign,     roles: ["owner"],              color: "#14B8A6" },
  { label: "Analytics & Reports", route: "/analytics",            icon: Insights,   roles: ["owner"],               color: "#F97316" },
  { label: "AI Intelligence",   route: "/ai-intelligence",     icon: Brain,          roles: ["owner"],              color: "#8B5CF6" },
  { label: "HR Management",     route: "/hr",                  icon: UserCheck,       roles: ["owner", "admin", "hr"],color: "#F472B6" },
  { label: "Settings",          route: "/settings",            icon: Settings,        roles: ["owner"],              color: "#94A3B8" },
];
