"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  Boxes,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CirclePlus,
  ClipboardList,
  FilePlus2,
  FileText,
  Info,
  LayoutGrid,
  Package,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Undo2,
  UserRoundPlus,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DASHBOARD_BRANCHES, DASHBOARD_NOTIFICATIONS, DATE_RANGES, LOW_STOCK_PRODUCTS, RECENT_ORDERS, REVENUE_DATA, SALES_TREND_DATA, TOP_SELLING_PRODUCTS, getMetrics } from "@/features/dashboard/mock-data";
import type { DashboardBranchId, DashboardDateRange, DashboardMetric, DashboardNotification, RevenuePeriod, SalesPeriod } from "@/features/dashboard/types";

const inr = (minor: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(minor / 100);
const number = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
const abbreviated = (value: number) => value === 0 ? "0" : `${Math.round(value / 1000)}K`;
const accent = {
  blue: { text: "text-blue-600", bg: "bg-blue-50", stroke: "#2563eb" },
  green: { text: "text-emerald-600", bg: "bg-emerald-50", stroke: "#10b981" },
  orange: { text: "text-orange-600", bg: "bg-orange-50", stroke: "#f97316" },
  purple: { text: "text-violet-600", bg: "bg-violet-50", stroke: "#8b5cf6" },
} as const;

function DashboardMenu({ children }: Readonly<{ children: React.ReactNode }>) { return <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 rounded-xl border bg-card p-2 shadow-xl">{children}</div>; }
function Tile({ imageClass }: Readonly<{ imageClass: string }>) { return <span aria-hidden="true" className={`${imageClass} block size-9 shrink-0 rounded-md border border-black/5`} />; }
function Panel({ title, description, children, action }: Readonly<{ title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }>) { return <section className="rounded-xl border bg-card p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-1.5 text-sm font-semibold">{title}{description ? <span title={description} className="inline-flex text-muted-foreground"><Info className="size-3.5" /></span> : null}</h2>{description ? <p className="sr-only">{description}</p> : null}</div>{action}</div>{children}</section>; }

function MetricCard({ metric }: Readonly<{ metric: DashboardMetric }>) {
  const Icon = metric.id === "sales" ? ShoppingBag : metric.id === "profit" ? WalletCards : metric.id === "orders" ? ClipboardList : Boxes;
  const color = accent[metric.accent];
  const Trend = metric.trend === "up" ? TrendingUp : TrendingDown;
  return <article className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-3"><span className={`${color.bg} ${color.text} grid size-11 place-items-center rounded-xl`}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{metric.title}</p><p className="mt-1 text-xl font-bold tracking-tight">{metric.id === "orders" ? number(metric.value) : inr(metric.value)}</p><p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${metric.trend === "up" ? "text-emerald-600" : "text-orange-600"}`}><Trend className="size-3" />{metric.changePercentage}% <span className="font-normal text-muted-foreground">{metric.comparisonText}</span></p></div><div className="h-12 w-20"><ResponsiveContainer><AreaChart data={metric.sparklineData.map((value, index) => ({ index, value }))}><Area type="monotone" dataKey="value" stroke={color.stroke} strokeWidth={2} fill="none" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></div></article>;
}

function StatusBadge({ status }: Readonly<{ status: string }>) { const classes: Record<string, string> = { Pending: "bg-orange-50 text-orange-700", Confirmed: "bg-emerald-50 text-emerald-700", Processing: "bg-blue-50 text-blue-700", Delivered: "bg-emerald-50 text-emerald-700", Cancelled: "bg-rose-50 text-rose-700", Low: "bg-orange-50 text-orange-700", Critical: "bg-rose-50 text-rose-700" }; return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${classes[status] ?? "bg-muted text-muted-foreground"}`}>{status}</span>; }

export function DashboardExperience() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [branch, setBranch] = useState<DashboardBranchId>("all");
  const [range, setRange] = useState<DashboardDateRange>("Last 7 Days");
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("Daily");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("This Week");
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<"branch" | "date" | "notifications" | "profile" | null>(null);
  const [notifications, setNotifications] = useState<DashboardNotification[]>(() => [...DASHBOARD_NOTIFICATIONS]);
  const [hasError, setHasError] = useState(false);
  const metrics = useMemo(() => getMetrics(branch, range), [branch, range]);
  const unread = notifications.filter((notification) => !notification.read).length;
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const values = [
      ...TOP_SELLING_PRODUCTS.map((product) => ({ label: product.name, detail: "Product", href: `/products/${product.id}` })),
      ...RECENT_ORDERS.map((order) => ({ label: order.orderNumber, detail: order.customerName, href: `/sales/orders/${order.id}` })),
      { label: "New sale", detail: "Quick action", href: "/pos" }, { label: "Add product", detail: "Quick action", href: "/products/new" }, { label: "Reports", detail: "Page", href: "/reports" },
    ];
    return values.filter((value) => `${value.label} ${value.detail}`.toLowerCase().includes(term)).slice(0, 6);
  }, [search]);
  useEffect(() => { const handleKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } if (event.key === "Escape") { setOpenMenu(null); searchRef.current?.blur(); } }; window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, []);
  const branchName = DASHBOARD_BRANCHES.find((item) => item.id === branch)?.name ?? "All Branches";
  if (hasError) return <div className="grid min-h-[60dvh] place-items-center"><section className="max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm"><X className="mx-auto size-8 text-destructive" /><h1 className="mt-3 font-semibold">Unable to load dashboard data</h1><p className="mt-1 text-sm text-muted-foreground">The dashboard data could not be refreshed right now.</p><Button className="mt-4" onClick={() => setHasError(false)}>Retry</Button></section></div>;
  return <div className="mx-auto max-w-[1600px] space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground">Overview of your business performance</p></div><div className="flex items-center gap-2"><div className="relative"><Button size="sm" variant="outline" onClick={() => setOpenMenu(openMenu === "branch" ? null : "branch")}><LayoutGrid /> {branchName}<ChevronDown /></Button>{openMenu === "branch" ? <DashboardMenu>{DASHBOARD_BRANCHES.map((item) => <button key={item.id} type="button" onClick={() => { setBranch(item.id); setOpenMenu(null); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${branch === item.id ? "bg-primary/10 text-primary" : ""}`}><span>{item.name}</span>{item.active ? <span className="size-2 rounded-full bg-emerald-500" /> : null}</button>)}</DashboardMenu> : null}</div><div className="relative"><Button size="sm" variant="outline" onClick={() => setOpenMenu(openMenu === "date" ? null : "date")}><CalendarDays /> 18 May 2024 - 24 May 2024<ChevronDown /></Button>{openMenu === "date" ? <DashboardMenu>{DATE_RANGES.map((item) => <button key={item} type="button" onClick={() => { setRange(item); setOpenMenu(null); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${range === item ? "bg-primary/10 text-primary" : ""}`}>{item}</button>)}</DashboardMenu> : null}</div><div className="relative"><Button variant="ghost" size="icon-sm" aria-label="Notifications" onClick={() => setOpenMenu(openMenu === "notifications" ? null : "notifications")}><Bell />{unread ? <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-destructive text-[9px] text-white">{unread}</span> : null}</Button>{openMenu === "notifications" ? <DashboardMenu><div className="flex items-center justify-between px-2 py-1"><p className="font-semibold">Notifications</p><Button size="xs" variant="ghost" onClick={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))}><CheckCheck /> Read all</Button></div>{notifications.length ? notifications.map((item) => <button key={item.id} type="button" onClick={() => setNotifications((current) => current.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification))} className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted"><span className="flex gap-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`} /><span><b className="block text-xs">{item.title}</b><span className="block text-[11px] text-muted-foreground">{item.detail} · {item.time}</span></span></span></button>) : <p className="p-4 text-center text-sm text-muted-foreground">No notifications</p>}<Link href="/audit-logs" className="block rounded-lg px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-primary/5">View all notifications</Link></DashboardMenu> : null}</div><div className="relative"><Button variant="ghost" size="sm" onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}><span className="grid size-7 place-items-center rounded-full bg-blue-100 font-semibold text-blue-700">AV</span><span className="hidden text-left sm:block"><span className="block text-xs font-semibold">Aman Verma</span><span className="block text-[10px] text-muted-foreground">Admin</span></span><ChevronDown /></Button>{openMenu === "profile" ? <DashboardMenu><Link className="block rounded-lg px-3 py-2 text-sm hover:bg-muted" href="/account/change-password">My Profile</Link><Link className="block rounded-lg px-3 py-2 text-sm hover:bg-muted" href="/settings">Account Settings</Link><button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setOpenMenu("branch")}>Switch Branch</button></DashboardMenu> : null}</div></div></header>
    <div className="relative"><Search className="absolute top-3 left-3 size-4 text-muted-foreground" /><Input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 max-w-xl pl-9 pr-16" placeholder="Search transactions, products, customers..." aria-label="Global search" /><kbd className="absolute top-2.5 left-[min(29rem,calc(100%-4rem))] rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Ctrl + K</kbd>{search ? <div className="absolute z-20 mt-2 w-full max-w-xl rounded-xl border bg-card p-2 shadow-xl">{searchResults.length ? searchResults.map((result) => <Link key={`${result.detail}-${result.label}`} href={result.href} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"><span className="text-sm font-medium">{result.label}</span><span className="text-xs text-muted-foreground">{result.detail}</span></Link>) : <p className="p-4 text-center text-sm text-muted-foreground">No search results</p>}</div> : null}</div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</section>
    <section className="grid gap-4 xl:grid-cols-2"><RevenueOverview period={revenuePeriod} setPeriod={setRevenuePeriod} /><SalesTrend period={salesPeriod} setPeriod={setSalesPeriod} /></section>
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"><TopSelling /><RecentOrders /><LowStock /><QuickActions onError={() => setHasError(true)} /></section>
  </div>;
}

function RevenueOverview({ period, setPeriod }: Readonly<{ period: RevenuePeriod; setPeriod: (value: RevenuePeriod) => void }>) { return <Panel title="Revenue Overview" description="Comparison of total sales revenue and product cost for the selected period." action={<select aria-label="Revenue overview period" value={period} onChange={(event) => setPeriod(event.target.value as RevenuePeriod)} className="h-8 rounded-md border bg-background px-2 text-xs"><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option></select>}><div className="mb-2 flex gap-4 text-[11px]"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" /> Revenue (PKR)</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-blue-200" /> Cost (PKR)</span></div><div className="h-64" aria-label="Revenue and cost bar chart"><ResponsiveContainer><BarChart data={REVENUE_DATA} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis tickFormatter={abbreviated} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => inr(Number(value) * 100)} cursor={{ fill: "#f8fafc" }} /><Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="cost" fill="#bfdbfe" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>; }
function SalesTrend({ period, setPeriod }: Readonly<{ period: SalesPeriod; setPeriod: (value: SalesPeriod) => void }>) { return <Panel title="Sales Trend" description="Tracks total sales value and number of completed orders over time." action={<select aria-label="Sales trend period" value={period} onChange={(event) => setPeriod(event.target.value as SalesPeriod)} className="h-8 rounded-md border bg-background px-2 text-xs"><option>Today</option><option>This Week</option><option>Last Week</option><option>This Month</option><option>Last Month</option></select>}><div className="mb-2 flex gap-4 text-[11px]"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" /> Sales (PKR)</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-blue-300" /> Orders</span></div><div className="h-64" aria-label="Sales and orders line chart"><ResponsiveContainer><LineChart data={SALES_TREND_DATA} margin={{ left: -18, right: -8, top: 8, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis yAxisId="sales" tickFormatter={abbreviated} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis yAxisId="orders" orientation="right" domain={[0, 50]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, key) => key === "sales" ? inr(Number(value) * 100) : Number(value)} /><Line yAxisId="sales" type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} /><Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div></Panel>; }
function TopSelling() { return <Panel title="Top Selling Tiles" description="Best-selling products for the selected period." action={<Link href="/products" className="text-xs font-semibold text-primary">View All</Link>}><p className="mb-2 text-right text-[10px] text-muted-foreground">Sold (Sq.Ft)</p><div className="space-y-1">{TOP_SELLING_PRODUCTS.map((item) => <Link key={item.id} href={`/products/${item.id}`} className="flex gap-2 rounded-lg p-1.5 hover:bg-muted"><Tile imageClass={item.imageClass} /><span className="min-w-0 flex-1"><b className="block truncate text-xs">{item.name}</b><span className="block text-[10px] text-muted-foreground">{item.finish}</span></span><span className="text-right text-[10px]"><b className="block">{number(item.soldSqFt)}</b><span className="font-medium text-emerald-600">{inr(item.salesAmount)}</span></span></Link>)}</div></Panel>; }
function RecentOrders() { return <Panel title="Recent Orders" action={<Link href="/sales/orders" className="text-xs font-semibold text-primary">View All</Link>}><div className="grid grid-cols-[1fr_1.2fr_.9fr_auto] gap-2 border-b pb-2 text-[10px] text-muted-foreground"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span></div><div className="divide-y">{RECENT_ORDERS.map((order) => <Link key={order.id} href={`/sales/orders/${order.id}`} className="grid grid-cols-[1fr_1.2fr_.9fr_auto] gap-2 py-2 text-[10px] hover:bg-muted"><span><b className="block text-primary">{order.orderNumber}</b><small className="text-muted-foreground">{order.date}</small></span><span className="truncate">{order.customerName}</span><span className="font-medium">{inr(order.amount)}</span><StatusBadge status={order.status} /></Link>)}</div></Panel>; }
function LowStock() { return <Panel title="Low Stock" action={<Link href="/inventory?filter=low-stock" className="text-xs font-semibold text-primary">View All</Link>}><div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b pb-2 text-[10px] text-muted-foreground"><span>Product</span><span>Stock</span><span>Status</span></div><div className="divide-y">{LOW_STOCK_PRODUCTS.map((item) => <Link key={item.id} href={`/products/${item.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-2 hover:bg-muted"><span className="flex min-w-0 items-center gap-2"><Tile imageClass={item.imageClass} /><span className="min-w-0"><b className="block truncate text-[10px]">{item.name}</b><small className="block truncate text-[9px] text-muted-foreground">{item.finish}</small></span></span><span className="text-[10px] font-medium">{number(item.stockSqFt)}</span><StatusBadge status={item.status} /></Link>)}</div></Panel>; }
function QuickActions({ onError }: Readonly<{ onError: () => void }>) { const actions = [{ label: "New Sale", href: "/pos", icon: ShoppingCart, color: "bg-blue-50 text-blue-600" }, { label: "Add Product", href: "/products/new", icon: CirclePlus, color: "bg-emerald-50 text-emerald-600" }, { label: "Add Customer", href: "/customers", icon: UserRoundPlus, color: "bg-orange-50 text-orange-600" }, { label: "New Purchase", href: "/purchases/new", icon: FilePlus2, color: "bg-violet-50 text-violet-600" }, { label: "Stock Adjustment", href: "/inventory/adjustments/new", icon: Package, color: "bg-blue-50 text-blue-600" }, { label: "Sales Return", href: "/sales", icon: Undo2, color: "bg-cyan-50 text-cyan-600" }, { label: "View Reports", href: "/reports", icon: FileText, color: "bg-rose-50 text-rose-600" }, { label: "Settings", href: "/settings", icon: Settings, color: "bg-muted text-muted-foreground" }]; return <Panel title="Quick Actions"><div className="grid grid-cols-4 gap-2">{actions.map(({ label, href, icon: Icon, color }) => <Link key={label} href={href} aria-label={label} className="group rounded-lg p-1.5 text-center outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className={`${color} mx-auto grid size-10 place-items-center rounded-lg transition group-hover:-translate-y-0.5`}><Icon className="size-5" /></span><span className="mt-1 block text-[9px] font-medium leading-3">{label}</span></Link>)}</div><Button variant="ghost" size="xs" className="mt-3 text-muted-foreground" onClick={onError}>Test error state</Button></Panel>; }
