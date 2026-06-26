export const NAV_SECTIONS = [
  {
    label: "Dashboard",
    items: [
      { label: "Dashboard", route: "/", icon: "ti-layout-dashboard", roles: ["owner"], end: true },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products",     route: "/products",  icon: "ti-box",             roles: ["owner", "staff"], end: true },
      { label: "Purchases",    route: "/purchases", icon: "ti-shopping-cart",   roles: ["owner", "staff"], end: true },
      { label: "POS / Billing", route: "/pos",      icon: "ti-receipt",         roles: ["owner", "staff"], end: true },
      { label: "Sales",        route: "/sales",     icon: "ti-clipboard-list",  roles: ["owner", "staff"], end: true },
      { label: "Credit Sales", route: "/credit",    icon: "ti-credit-card",     roles: ["owner", "staff"], end: true },
      { label: "Expenses",     route: "/expenses",  icon: "ti-currency-dollar", roles: ["owner", "staff"], end: true },
      { label: "Warehouses",   route: "/warehouses", icon: "ti-building-warehouse", roles: ["owner", "staff"], end: true },
      { label: "Devices",      route: "/devices",   icon: "ti-device-desktop",  roles: ["owner", "staff"], end: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Finance Overview", route: "/finance", icon: "ti-coin", roles: ["owner"], end: true },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Analytics & Reports", route: "/analytics",       icon: "ti-chart-line",   roles: ["owner"], end: true },
      { label: "AI Intelligence",     route: "/ai-intelligence",  icon: "ti-robot",        roles: ["owner"], end: true },
      { label: "Reminders",           route: "/reminders",        icon: "ti-bell-ringing", roles: ["owner", "staff"], end: true },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "HR Management", route: "/hr",       icon: "ti-users",              roles: ["owner", "admin", "hr"], end: true },
      { label: "Team Management", route: "/people", icon: "ti-user-cog",           roles: ["owner"], end: false },
      { label: "Settings",      route: "/settings", icon: "ti-settings",           roles: ["owner"], end: false },
    ],
  },
];
