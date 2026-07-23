export const NAVIGATION_ICON_KEYS = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "inventory",
  "purchases",
  "suppliers",
  "customers",
  "expenses",
  "reports",
  "users",
  "settings",
  "audit",
] as const;

export type NavigationIconKey = (typeof NAVIGATION_ICON_KEYS)[number];

export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIconKey;
  description: string;
  permissions: readonly PermissionKey[];
}

export const navigationItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    description: "Operational overview",
    permissions: ["dashboard.view"],
  },
  {
    href: "/pos",
    label: "POS",
    icon: "pos",
    description: "Point-of-sale workspace",
    permissions: ["sale.create"],
  },
  {
    href: "/sales",
    label: "Sales",
    icon: "sales",
    description: "Sales and customer returns",
    permissions: ["sale.view"],
  },
  {
    href: "/products",
    label: "Products",
    icon: "products",
    description: "Products, variants, and categories",
    permissions: ["product.view"],
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: "inventory",
    description: "Balances and stock ledger",
    permissions: ["inventory.view"],
  },
  {
    href: "/purchases",
    label: "Purchases",
    icon: "purchases",
    description: "Purchase orders and receiving",
    permissions: ["purchase.view"],
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: "suppliers",
    description: "Supplier directory",
    permissions: ["supplier.manage"],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: "customers",
    description: "Customer directory",
    permissions: ["sale.view"],
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: "expenses",
    description: "Business expenses and approvals",
    permissions: ["expense.view"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "reports",
    description: "Sales, inventory, and profit reports",
    permissions: ["report.sales", "report.inventory", "report.profit"],
  },
  {
    href: "/users",
    label: "Users",
    icon: "users",
    description: "Users, roles, and permissions",
    permissions: ["user.view"],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    description: "Business and application settings",
    permissions: ["settings.manage"],
  },
  {
    href: "/audit-logs",
    label: "Audit Logs",
    icon: "audit",
    description: "Sensitive activity history",
    permissions: ["audit.view"],
  },
] as const satisfies readonly NavigationItem[];

export function isNavigationItemActive(
  pathname: string,
  href: string,
): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavigationItemBySegment(
  segment: string,
): NavigationItem | undefined {
  return navigationItems.find((item) => item.href === `/${segment}`);
}
import type { PermissionKey } from "@/features/auth/permissions";
