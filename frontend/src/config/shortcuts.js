export const SHORTCUTS = {
  "app.commandPalette": { combo: "Ctrl+K", description: "Open command palette", category: "Global", priority: 100 },
  "app.help": { combo: "Ctrl+H", description: "Open help and documentation", category: "Global", priority: 100 },
  "app.themeToggle": { combo: "Ctrl+D", description: "Toggle dark/light theme", category: "Global", priority: 100 },
  "nav.dashboard": { combo: "Ctrl+1", description: "Go to Dashboard", category: "Navigation", priority: 90 },
  "nav.products": { combo: "Ctrl+2", description: "Go to Products", category: "Navigation", priority: 90 },
  "nav.sales": { combo: "Ctrl+3", description: "Go to Sales", category: "Navigation", priority: 90 },
  "nav.expenses": { combo: "Ctrl+4", description: "Go to Expenses", category: "Navigation", priority: 90 },
  "nav.finance": { combo: "Ctrl+5", description: "Go to Finance", category: "Navigation", priority: 90 },
  "nav.analytics": { combo: "Ctrl+6", description: "Go to Analytics", category: "Navigation", priority: 90 },
  "nav.users": { combo: "Ctrl+7", description: "Go to Users", category: "Navigation", priority: 90 },
  "products.add": { combo: "Ctrl+N", description: "Add product", category: "Products", priority: 80 },
  "products.editSelected": { combo: "Ctrl+E", description: "Edit selected product", category: "Products", priority: 80 },
  "products.deleteSelected": { combo: "Delete", description: "Delete selected product", category: "Products", priority: 80 },
  "sales.new": { combo: "Ctrl+N", description: "Create sale", category: "Sales", priority: 80 },
  "expenses.new": { combo: "Ctrl+N", description: "Add expense", category: "Expenses", priority: 80 },
};

export const COMMAND_ITEMS = [
  { id: "cmd.dashboard", label: "Go to Dashboard", actionId: "nav.dashboard", roles: ["owner"] },
  { id: "cmd.products", label: "Go to Products", actionId: "nav.products", roles: ["owner", "staff"] },
  { id: "cmd.analytics", label: "Go to Analytics", actionId: "nav.analytics", roles: ["owner"] },
  { id: "cmd.sales", label: "Create Sale", actionId: "sales.new", roles: ["owner", "staff"] },
  { id: "cmd.addProduct", label: "Add Product", actionId: "products.add", roles: ["owner", "staff"] },
  { id: "cmd.theme", label: "Toggle Theme", actionId: "app.themeToggle", roles: ["owner", "staff"] },
];

export function formatShortcut(actionId) {
  return SHORTCUTS[actionId]?.combo || "";
}
