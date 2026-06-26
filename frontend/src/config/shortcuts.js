export const SHORTCUTS = {
  "app.commandPalette": { combo: "Ctrl+K", description: "Open command palette", category: "Global", priority: 100 },
  "app.help": { combo: "Ctrl+H", description: "Open help and documentation", category: "Global", priority: 100 },
  "app.themeToggle": { combo: "Ctrl+D", description: "Toggle dark/light theme", category: "Global", priority: 100 },
  "nav.dashboard": { combo: "Ctrl+1", description: "Go to Dashboard", category: "Navigation", priority: 90 },
  "nav.products": { combo: "Ctrl+2", description: "Go to Products", category: "Navigation", priority: 90 },
  "nav.sales": { combo: "Ctrl+3", description: "Go to Sales", category: "Navigation", priority: 90 },
  "nav.purchases": { combo: "Ctrl+4", description: "Go to Purchases", category: "Navigation", priority: 90 },
  "nav.credit": { combo: "Ctrl+5", description: "Go to Credit Management", category: "Navigation", priority: 90 },
  "nav.expenses": { combo: "Ctrl+6", description: "Go to Expenses", category: "Navigation", priority: 90 },
  "nav.finance": { combo: "Ctrl+7", description: "Go to Finance", category: "Navigation", priority: 90 },
  "nav.ledger": { combo: "Shift+Ctrl+7", description: "Go to Account Ledger", category: "Navigation", priority: 90 },
  "nav.analytics": { combo: "Ctrl+8", description: "Go to Analytics", category: "Navigation", priority: 90 },
  "nav.ai": { combo: "Shift+Ctrl+8", description: "Go to AI Intelligence", category: "Navigation", priority: 90 },
  "nav.devices": { combo: "Ctrl+Shift+2", description: "Go to Devices", category: "Navigation", priority: 90 },
  "nav.reminders": { combo: "Ctrl+0", description: "Go to Reminders", category: "Navigation", priority: 90 },
  "nav.users": { combo: "Ctrl+9", description: "Go to Users", category: "Navigation", priority: 90 },
  "products.add": { combo: "Ctrl+N", description: "Add product", category: "Products", priority: 80 },
  "products.editSelected": { combo: "Ctrl+E", description: "Edit selected product", category: "Products", priority: 80 },
  "products.deleteSelected": { combo: "Delete", description: "Delete selected product", category: "Products", priority: 80 },
  "sales.new": { combo: "Ctrl+N", description: "Create sale", category: "Sales", priority: 80 },
  "expenses.new": { combo: "Ctrl+N", description: "Add expense", category: "Expenses", priority: 80 },
};

export const COMMAND_ITEMS = [
  { id: "cmd.dashboard", label: "Go to Dashboard", actionId: "nav.dashboard", roles: ["owner"] },
  { id: "cmd.products", label: "Go to Products", actionId: "nav.products", roles: ["owner", "staff"] },
  { id: "cmd.purchases", label: "Go to Purchases", actionId: "nav.purchases", roles: ["owner", "staff"] },
  { id: "cmd.sales", label: "Go to Sales", actionId: "nav.sales", roles: ["owner", "staff"] },
  { id: "cmd.credit", label: "Go to Credit Management", actionId: "nav.credit", roles: ["owner", "staff"] },
  { id: "cmd.expenses", label: "Go to Expenses", actionId: "nav.expenses", roles: ["owner", "staff"] },
  { id: "cmd.finance", label: "Go to Finance", actionId: "nav.finance", roles: ["owner"] },
  { id: "cmd.ledger", label: "Go to Account Ledger", actionId: "nav.ledger", roles: ["owner"] },
  { id: "cmd.analytics", label: "Go to Analytics", actionId: "nav.analytics", roles: ["owner"] },
  { id: "cmd.ai", label: "Go to AI Intelligence", actionId: "nav.ai", roles: ["owner"] },
  { id: "cmd.devices", label: "Go to Devices", actionId: "nav.devices", roles: ["owner", "staff"] },
  { id: "cmd.reminders", label: "Go to Reminders", actionId: "nav.reminders", roles: ["owner", "staff"] },
  { id: "cmd.hr", label: "Go to HR Management", actionId: "nav.hr", roles: ["owner", "admin", "hr"] },
  { id: "cmd.users", label: "Go to People", actionId: "nav.users", roles: ["owner"] },
  { id: "cmd.sales.new", label: "Create Sale", actionId: "sales.new", roles: ["owner", "staff"] },
  { id: "cmd.addProduct", label: "Add Product", actionId: "products.add", roles: ["owner", "staff"] },
  { id: "cmd.theme", label: "Toggle Theme", actionId: "app.themeToggle", roles: ["owner", "staff"] },
];

export function formatShortcut(actionId) {
  return SHORTCUTS[actionId]?.combo || "";
}
