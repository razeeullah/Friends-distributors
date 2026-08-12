export type DashboardBranchId = "all" | "main" | "islamabad" | "rawalpindi" | "warehouse";
export type DashboardDateRange = "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Last Month" | "Custom Range";
export type RevenuePeriod = "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly";
export type SalesPeriod = "Today" | "This Week" | "Last Week" | "This Month" | "Last Month";

export interface DashboardMetric {
  id: "sales" | "profit" | "orders" | "inventory";
  title: string;
  value: number;
  changePercentage: number;
  comparisonText: string;
  trend: "up" | "down";
  accent: "blue" | "green" | "orange" | "purple";
  sparklineData: number[];
}

export interface RevenueDataPoint { date: string; revenue: number; cost: number; }
export interface SalesTrendDataPoint { date: string; sales: number; orders: number; }
export interface TopSellingProduct { id: string; name: string; finish: string; imageClass: string; soldSqFt: number; salesAmount: number; }
export type OrderStatus = "Pending" | "Confirmed" | "Processing" | "Delivered" | "Cancelled";
export interface RecentOrder { id: string; orderNumber: string; date: string; customerName: string; amount: number; status: OrderStatus; }
export interface LowStockProduct { id: string; name: string; finish: string; imageClass: string; stockSqFt: number; status: "Low" | "Critical"; }
export interface DashboardNotification { id: string; title: string; detail: string; time: string; read: boolean; }
export interface DashboardBranch { id: DashboardBranchId; name: string; active?: boolean; }
