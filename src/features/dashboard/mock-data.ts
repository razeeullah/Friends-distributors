import type { DashboardBranch, DashboardDateRange, DashboardMetric, DashboardNotification, LowStockProduct, RecentOrder, RevenueDataPoint, SalesTrendDataPoint, TopSellingProduct } from "@/features/dashboard/types";

export const DASHBOARD_BRANCHES: readonly DashboardBranch[] = [
  { id: "all", name: "All Branches" }, { id: "main", name: "Main Branch", active: true }, { id: "islamabad", name: "Islamabad Branch" }, { id: "rawalpindi", name: "Rawalpindi Branch" }, { id: "warehouse", name: "Warehouse Branch" },
];
export const DATE_RANGES: readonly DashboardDateRange[] = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Last Month", "Custom Range"];
export const REVENUE_DATA: readonly RevenueDataPoint[] = [
  { date: "18 May", revenue: 120000, cost: 65000 }, { date: "19 May", revenue: 150000, cost: 80000 }, { date: "20 May", revenue: 185000, cost: 85000 }, { date: "21 May", revenue: 215000, cost: 100000 }, { date: "22 May", revenue: 178000, cost: 95000 }, { date: "23 May", revenue: 190000, cost: 105000 }, { date: "24 May", revenue: 250000, cost: 120000 },
];
export const SALES_TREND_DATA: readonly SalesTrendDataPoint[] = [
  { date: "18 May", sales: 120000, orders: 10 }, { date: "19 May", sales: 170000, orders: 16 }, { date: "20 May", sales: 205000, orders: 22 }, { date: "21 May", sales: 270000, orders: 32 }, { date: "22 May", sales: 185000, orders: 24 }, { date: "23 May", sales: 225000, orders: 26 }, { date: "24 May", sales: 270000, orders: 38 },
];
export const TOP_SELLING_PRODUCTS: readonly TopSellingProduct[] = [
  { id: "marble-white", name: "Marble White 600x600", finish: "Glossy Finish", imageClass: "tile-marble-white", soldSqFt: 1245.5, salesAmount: 6227500 }, { id: "wood-brown", name: "Wood Finish Brown 1200x600", finish: "Matt Finish", imageClass: "tile-wood-brown", soldSqFt: 980.25, salesAmount: 5881500 }, { id: "outdoor-grey", name: "Outdoor Stone Gray 600x600", finish: "Anti-Skid Finish", imageClass: "tile-stone-grey", soldSqFt: 875, salesAmount: 4375000 }, { id: "glossy-beige", name: "Glossy Beige 800x800", finish: "Glossy Finish", imageClass: "tile-glossy-beige", soldSqFt: 720.3, salesAmount: 4033500 },
];
export const RECENT_ORDERS: readonly RecentOrder[] = [
  { id: "1258", orderNumber: "#ORD-1258", date: "24 May 2024", customerName: "Shree Balaji Enterprises", amount: 4875000, status: "Pending" }, { id: "1257", orderNumber: "#ORD-1257", date: "24 May 2024", customerName: "Garg Builders", amount: 3294000, status: "Confirmed" }, { id: "1256", orderNumber: "#ORD-1256", date: "23 May 2024", customerName: "OM Interiors", amount: 2765000, status: "Processing" }, { id: "1255", orderNumber: "#ORD-1255", date: "23 May 2024", customerName: "Patel Construction", amount: 11250000, status: "Delivered" }, { id: "1254", orderNumber: "#ORD-1254", date: "22 May 2024", customerName: "R.K. Traders", amount: 1986000, status: "Delivered" },
];
export const LOW_STOCK_PRODUCTS: readonly LowStockProduct[] = [
  { id: "marble-white", name: "Marble White 600x600", finish: "Glossy Finish", imageClass: "tile-marble-white", stockSqFt: 120.5, status: "Low" }, { id: "wood-brown", name: "Wood Finish Brown 1200x600", finish: "Matt Finish", imageClass: "tile-wood-brown", stockSqFt: 98.75, status: "Low" }, { id: "outdoor-grey", name: "Outdoor Stone Gray 600x600", finish: "Anti-Skid Finish", imageClass: "tile-stone-grey", stockSqFt: 75.2, status: "Low" }, { id: "glossy-beige", name: "Glossy Beige 800x800", finish: "Glossy Finish", imageClass: "tile-glossy-beige", stockSqFt: 60, status: "Critical" },
];
export const DASHBOARD_NOTIFICATIONS: readonly DashboardNotification[] = [
  { id: "low-stock", title: "Critical stock alert", detail: "Glossy Beige 800x800 is below its reorder level.", time: "5m ago", read: false }, { id: "new-order", title: "New order received", detail: "#ORD-1258 has been placed by Shree Balaji Enterprises.", time: "22m ago", read: false }, { id: "payment", title: "Invoice payment completed", detail: "Payment received for #ORD-1252.", time: "1h ago", read: false }, { id: "purchase", title: "Purchase order pending", detail: "PO-1024 needs approval before receiving.", time: "2h ago", read: true }, { id: "overdue", title: "Customer payment overdue", detail: "R.K. Traders has an overdue payment.", time: "Yesterday", read: true },
];
export function getMetrics(branch: DashboardBranch["id"], range: DashboardDateRange): DashboardMetric[] {
  const factor = branch === "all" ? 1 : branch === "main" ? 0.72 : branch === "warehouse" ? 0.28 : 0.42;
  const rangeFactor = range === "Today" ? 1 : range === "Yesterday" ? 0.84 : range === "Last 30 Days" ? 1.36 : range === "This Month" ? 1.14 : 1;
  return [
    { id: "sales", title: "Today's Sales", value: Math.round(24875000 * factor * rangeFactor), changePercentage: 18.6, comparisonText: "vs yesterday", trend: "up", accent: "blue", sparklineData: [30, 37, 34, 48, 55, 48, 68] },
    { id: "profit", title: "Today's Profit", value: Math.round(6854000 * factor * rangeFactor), changePercentage: 15.3, comparisonText: "vs yesterday", trend: "up", accent: "green", sparklineData: [18, 23, 21, 31, 36, 34, 45] },
    { id: "orders", title: "Pending Orders", value: Math.round(24 * factor * rangeFactor), changePercentage: 9.1, comparisonText: "vs yesterday", trend: "down", accent: "orange", sparklineData: [14, 17, 15, 21, 20, 26, 30] },
    { id: "inventory", title: "Inventory Value", value: Math.round(1863542000 * factor), changePercentage: 7.8, comparisonText: "vs last week", trend: "up", accent: "purple", sparklineData: [28, 32, 31, 40, 45, 42, 55] },
  ];
}
