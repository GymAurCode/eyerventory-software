import {
  BarChart3,
  FileText,
  Handshake,
  Insights,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "../components/icons/SidebarIcons";

export const SIDEBAR_ITEMS = [
  { label: "Dashboard", route: "/", icon: LayoutDashboard, roles: ["owner"] },
  { label: "Products", route: "/products", icon: Package, roles: ["owner", "staff"] },
  { label: "Sales", route: "/sales", icon: ShoppingCart, roles: ["owner", "staff"] },
  { label: "Expenses", route: "/expenses", icon: Wallet, roles: ["owner", "staff"] },
  { label: "Finance", route: "/finance", icon: BarChart3, roles: ["owner"] },
  { label: "Analytics", route: "/analytics", icon: Insights, roles: ["owner"] },
  { label: "Users", route: "/users", icon: Users, roles: ["owner"] },
  { label: "Partners", route: "/partners", icon: Handshake, roles: ["owner"] },
  { label: "Reports", route: "/reports", icon: FileText, roles: ["owner"] },
  { label: "Settings", route: "/settings", icon: Settings, roles: ["owner"] },
];
