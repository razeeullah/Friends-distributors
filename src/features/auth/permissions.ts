export const PERMISSION_DEFINITIONS = [
  ["dashboard.view", "View operational dashboard"],
  ["product.view", "View products and variants"],
  ["product.create", "Create products and variants"],
  ["product.update", "Update products and variants"],
  ["product.archive", "Archive products and variants"],
  ["category.manage", "Manage product categories"],
  ["category.view", "View product categories"],
  ["category.create", "Create product categories"],
  ["category.update", "Update product categories"],
  ["category.archive", "Archive product categories"],
  ["category.restore", "Restore product categories"],
  ["supplier.manage", "Manage suppliers"],
  ["purchase.view", "View purchases"],
  ["purchase.create", "Create purchase orders"],
  ["purchase.receive", "Receive purchases into inventory"],
  ["inventory.view", "View inventory and stock ledger"],
  ["inventory.adjust", "Create and complete stock adjustments"],
  ["inventory.transfer", "Transfer stock between locations"],
  ["sale.view", "View sales"],
  ["sale.create", "Create completed sales"],
  ["sale.discount", "Apply permitted sale discounts"],
  ["sale.override_price", "Override a product sale price"],
  ["sale.void", "Void a completed sale"],
  ["sale.refund", "Create a customer return and refund"],
  ["customer.create", "Create customers from point of sale"],
  ["register.open", "Open a cash register session"],
  ["register.close", "Close a cash register session"],
  ["register.cash_movement", "Record cash in and cash out"],
  ["register.view_all", "View register session history"],
  ["expense.view", "View expenses"],
  ["expense.create", "Create expenses"],
  ["expense.approve", "Approve or reject expenses"],
  ["report.sales", "View sales reports"],
  ["report.inventory", "View inventory reports"],
  ["report.profit", "View gross and net profit reports"],
  ["user.view", "View users"],
  ["user.manage", "Create, update, disable, and unlock users"],
  ["role.manage", "Manage roles and permission assignments"],
  [
    "role.manage.unrestricted",
    "Assign permissions beyond the administrator's own effective access",
  ],
  ["settings.manage", "Manage business settings"],
  ["audit.view", "View immutable audit logs"],
] as const;

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number][0];

export const DEFAULT_ROLE_DEFINITIONS = [
  ["SUPER_ADMIN", "Super Admin", "Unrestricted system administrator"],
  ["OWNER", "Owner", "Business owner with full operational access"],
  ["MANAGER", "Manager", "Store manager with operational and staff access"],
  ["CASHIER", "Cashier", "Point-of-sale operator"],
  ["INVENTORY_STAFF", "Inventory Staff", "Purchasing and inventory operator"],
  ["ACCOUNTANT", "Accountant", "Expense and financial reporting operator"],
] as const;

export type DefaultRole = (typeof DEFAULT_ROLE_DEFINITIONS)[number][0];

const operationalManagerPermissions = PERMISSION_DEFINITIONS.map(
  ([key]) => key,
).filter(
  (key) =>
    key !== "role.manage" &&
    key !== "role.manage.unrestricted" &&
    key !== "settings.manage",
);

export const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSION_DEFINITIONS.map(([key]) => key),
  OWNER: PERMISSION_DEFINITIONS.map(([key]) => key),
  MANAGER: operationalManagerPermissions,
  CASHIER: [
    "dashboard.view",
    "product.view",
    "inventory.view",
    "sale.view",
    "sale.create",
    "sale.discount",
    "customer.create",
    "register.open",
    "register.close",
    "register.cash_movement",
  ],
  INVENTORY_STAFF: [
    "dashboard.view",
    "product.view",
    "product.create",
    "product.update",
    "category.manage",
    "supplier.manage",
    "purchase.view",
    "purchase.create",
    "purchase.receive",
    "inventory.view",
    "inventory.adjust",
    "inventory.transfer",
    "report.inventory",
  ],
  ACCOUNTANT: [
    "dashboard.view",
    "purchase.view",
    "sale.view",
    "expense.view",
    "expense.create",
    "expense.approve",
    "report.sales",
    "report.inventory",
    "report.profit",
    "audit.view",
  ],
} satisfies Record<DefaultRole, readonly PermissionKey[]>;

const permissionKeySet = new Set<string>(
  PERMISSION_DEFINITIONS.map(([key]) => key),
);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeySet.has(value);
}
