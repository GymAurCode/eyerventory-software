import {
  BarChart3,
<<<<<<< HEAD
  Bell,
  BookOpen,
  CreditCard,
=======
  Brain,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Handshake,
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
  Insights,
  LayoutDashboard,
  Package,
  Bot,
  Settings,
  ShoppingBag,
  ShoppingCart,
  UserCheck,
  Wallet,
} from "../components/icons/SidebarIcons";

// Users and Backup are now tabs inside Settings — not standalone sidebar entries.
export const SIDEBAR_ITEMS = [
<<<<<<< HEAD
  { label: "Dashboard",        route: "/",               icon: LayoutDashboard, roles: ["owner"],               color: "#6366f1", end: true  },
  { label: "Products",         route: "/products",        icon: Package,         roles: ["owner", "staff"],      color: "#f59e0b", end: true  },
  { label: "Sales",            route: "/sales",           icon: ShoppingCart,    roles: ["owner", "staff"],      color: "#10b981", end: true  },
  { label: "Purchases",        route: "/purchases",       icon: ShoppingBag,     roles: ["owner", "staff"],      color: "#8b5cf6", end: true  },
  { label: "Credit Management",route: "/credit",          icon: CreditCard,      roles: ["owner", "staff"],      color: "#0ea5e9", end: true  },
  { label: "Expenses",         route: "/expenses",        icon: Wallet,          roles: ["owner", "staff"],      color: "#ef4444", end: true  },
  { label: "Finance",          route: "/finance",         icon: BarChart3,       roles: ["owner"],               color: "#3b82f6", end: true  },
  { label: "Accounting",       route: "/accounting",      icon: BookOpen,        roles: ["owner"],               color: "#8b5cf6", end: true  },
  { label: "Analytics",        route: "/analytics",       icon: Insights,        roles: ["owner"],               color: "#8b5cf6", end: true  },
  { label: "AI Intelligence",  route: "/ai-intelligence", icon: Bot,             roles: ["owner"],               color: "#06b6d4", end: false },
  { label: "Reminders",        route: "/reminders",       icon: Bell,            roles: ["owner", "staff"],      color: "#f97316", end: true  },
  { label: "People",           route: "/people",          icon: Users,           roles: ["owner"],               color: "#ec4899", end: false },
  { label: "HR Management",    route: "/hr",              icon: UserCheck,       roles: ["owner", "admin", "hr"],color: "#a855f7", end: true  },
  { label: "Settings",         route: "/settings",        icon: Settings,        roles: ["owner"],               color: "#94a3b8", end: false },
=======
  { label: "Dashboard",         route: "/",                    icon: LayoutDashboard, roles: ["owner"],              color: "#6366F1" },
  { label: "Products",          route: "/products",            icon: Package,         roles: ["owner", "staff"],     color: "#22C55E" },
  { label: "Sales",             route: "/sales",               icon: ShoppingCart,    roles: ["owner", "staff"],     color: "#06B6D4" },
  { label: "Purchases",         route: "/accounting/purchases",icon: Package,         roles: ["owner"],              color: "#8B5CF6" },
  { label: "Expenses",          route: "/expenses",            icon: Wallet,          roles: ["owner", "staff"],     color: "#F59E0B" },
  { label: "Finance",           route: "/finance",             icon: BarChart3,       roles: ["owner"],              color: "#10B981" },
  { label: "Chart of Accounts", route: "/accounting/coa",     icon: FileText,        roles: ["owner"],              color: "#3B82F6" },
  { label: "Credit Management", route: "/accounting/credit",  icon: CreditCard,      roles: ["owner"],              color: "#EC4899" },
  { label: "Payments",          route: "/accounting/payments", icon: DollarSign,     roles: ["owner"],              color: "#14B8A6" },
  { label: "Analytics & Reports", route: "/analytics",            icon: Insights,   roles: ["owner"],               color: "#F97316" },
  { label: "AI Intelligence",   route: "/ai-intelligence",     icon: Brain,          roles: ["owner"],              color: "#8B5CF6" },
  { label: "Partners",            route: "/partners",             icon: Handshake,  roles: ["owner"],               color: "#E11D48" },
  { label: "HR Management",     route: "/hr",                  icon: UserCheck,       roles: ["owner", "admin", "hr"],color: "#F472B6" },
  { label: "Settings",          route: "/settings",            icon: Settings,        roles: ["owner"],              color: "#94A3B8" },
>>>>>>> a9021499fc116a37fb0466bd4381e05a1186f38a
];
