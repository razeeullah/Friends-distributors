import {
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  PackageSearch,
  Plus,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/session";
import { getDashboardMetrics } from "@/features/reports/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

export const metadata: Metadata = { title: "Dashboard" };
const money = (value: { toString(): string }) =>
  formatMoney(parseMoneyToMinor(value.toString()));
function Sparkline({ color }: { color: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 42" className="h-11 w-28">
      <path
        d="M2 35 C15 33, 14 20, 28 25 S46 10, 57 19 S70 11, 81 17 S99 3, 118 8"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
export default async function DashboardPage() {
  const context = await requirePermission("dashboard.view");
  const metrics = await getDashboardMetrics(
    context.business.id,
    context.locations.map((location) => location.id),
    context.permissions.has("report.profit"),
  );
  const cards = [
    {
      label: "Today’s sales",
      value: money(metrics.sales),
      note: `${metrics.transactions} transactions`,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50",
      spark: "#2563eb",
    },
    {
      label: "Today’s profit",
      value: metrics.grossProfit ? money(metrics.grossProfit) : "Restricted",
      note: metrics.grossProfit
        ? "Net of tax and COGS"
        : "Requires report permission",
      icon: WalletCards,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      spark: "#059669",
    },
    {
      label: "Average order",
      value: money(metrics.averageOrder),
      note: "Average transaction value",
      icon: ReceiptText,
      color: "text-orange-600",
      bg: "bg-orange-50",
      spark: "#f97316",
    },
    {
      label: "Inventory value",
      value: money(metrics.inventoryValue),
      note: `${metrics.openRegisters} open registers`,
      icon: Boxes,
      color: "text-violet-600",
      bg: "bg-violet-50",
      spark: "#7c3aed",
    },
  ];
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageTitle
        eyebrow={context.business.name}
        title="Dashboard"
        description="Overview of your business performance today."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">
              View reports <ArrowRight />
            </Link>
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, color, bg, spark }) => (
          <article
            key={label}
            className="bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className={`${bg} ${color} grid size-11 place-items-center rounded-xl`}
              >
                <Icon className="size-5" />
              </div>
              <Sparkline color={spark} />
            </div>
            <p className="mt-4 text-sm font-medium">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-muted-foreground mt-1 text-xs">{note}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.25fr_.9fr]">
        <DashboardPanel
          title="Revenue overview"
          description="Daily sales and inventory value at your active locations."
        >
          <div className="flex h-64 items-end justify-between gap-3 border-b px-3 pb-3">
            {[45, 62, 55, 78, 66, 84, 92].map((height, index) => (
              <div
                key={height}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div
                  className="w-full rounded-t-md bg-blue-600/90"
                  style={{ height: `${height}%` }}
                />
                <div
                  className="w-full rounded-t-md bg-blue-200"
                  style={{ height: `${Math.max(16, height - 25)}%` }}
                />
                <span className="text-muted-foreground text-[10px]">
                  D{index + 1}
                </span>
              </div>
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel
          title="Sales trend"
          description="Transaction activity for the current trading day."
        >
          <div className="flex h-64 items-center justify-center">
            <svg viewBox="0 0 500 220" className="h-full w-full">
              <path
                d="M20 180 L85 150 L150 160 L215 92 L280 125 L345 68 L410 94 L480 45"
                fill="none"
                stroke="#2563eb"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 195 L85 178 L150 185 L215 142 L280 160 L345 120 L410 145 L480 108"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="3"
                strokeDasharray="7 7"
              />
            </svg>
          </div>
        </DashboardPanel>
      </section>
      <section className="grid gap-5 lg:grid-cols-3">
        <DashboardPanel
          title="Quick actions"
          description="Common retail tasks."
        >
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/pos" icon={ShoppingBag} label="New sale" />
            <QuickAction href="/products/new" icon={Plus} label="Add product" />
            <QuickAction
              href="/inventory/adjustments/new"
              icon={PackageSearch}
              label="Stock adjustment"
            />
            <QuickAction
              href="/purchases/new"
              icon={ClipboardList}
              label="New purchase"
            />
          </div>
        </DashboardPanel>
        <DashboardPanel
          title="Operational status"
          description="Live, permission-scoped indicators."
        >
          <dl className="divide-y text-sm">
            <Metric
              label="Open registers"
              value={String(metrics.openRegisters)}
            />
            <Metric
              label="Transactions today"
              value={String(metrics.transactions)}
            />
            <Metric
              label="Net profit today"
              value={
                metrics.netProfit ? money(metrics.netProfit) : "Restricted"
              }
            />
            <Metric
              label="Inventory value"
              value={money(metrics.inventoryValue)}
            />
          </dl>
        </DashboardPanel>
        <DashboardPanel
          title="Performance snapshot"
          description="Use reports for detailed trends."
        >
          <div className="space-y-4">
            <Snapshot
              icon={TrendingUp}
              label="Sales today"
              value={money(metrics.sales)}
              color="text-blue-600"
            />
            <Snapshot
              icon={BarChart3}
              label="Average order"
              value={money(metrics.averageOrder)}
              color="text-emerald-600"
            />
            <Snapshot
              icon={CircleDollarSign}
              label="Gross profit"
              value={
                metrics.grossProfit ? money(metrics.grossProfit) : "Restricted"
              }
              color="text-violet-600"
            />
          </div>
        </DashboardPanel>
      </section>
    </div>
  );
}
function DashboardPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </div>
      {children}
    </section>
  );
}
function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-muted/30 hover:border-primary/40 hover:bg-primary/5 rounded-lg border p-3 transition"
    >
      <Icon className="text-primary size-5" />
      <p className="mt-3 text-sm font-medium">{label}</p>
    </Link>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
function Snapshot({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`${color} bg-muted grid size-9 place-items-center rounded-lg`}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
