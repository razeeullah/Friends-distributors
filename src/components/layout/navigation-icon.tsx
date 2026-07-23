import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { NavigationIconKey } from "@/components/layout/navigation";

const navigationIcons = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  sales: ReceiptText,
  products: Package,
  inventory: Warehouse,
  purchases: ClipboardList,
  suppliers: Truck,
  customers: Users,
  expenses: CircleDollarSign,
  reports: BarChart3,
  users: UserCog,
  settings: Settings,
  audit: ScrollText,
} satisfies Record<NavigationIconKey, LucideIcon>;

export function NavigationIcon({
  icon,
  className = "size-4",
}: Readonly<{ icon: NavigationIconKey; className?: string }>) {
  const Icon = navigationIcons[icon];
  return <Icon className={className} aria-hidden="true" />;
}
