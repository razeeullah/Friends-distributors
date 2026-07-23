import {
  BarChart3,
  CreditCard,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { listSales } from "@/features/sales/queries";
import { Prisma } from "@/generated/prisma/client";
import { formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

const money = (value: { toString(): string }) =>
  formatMoney(parseMoneyToMinor(value.toString()));

export default async function SalesPage() {
  const context = await requirePermission("sale.view");
  const sales = await listSales(
    context.business.id,
    context.locations.map((location) => location.id),
  );
  const completed = sales.filter((sale) => sale.status === "COMPLETED");
  const returned = sales.filter(
    (sale) => sale.status === "REFUNDED" || sale.refundedAmount.gt(0),
  );
  const total = completed.reduce(
    (sum, sale) => sum.add(sale.total),
    new Prisma.Decimal(0),
  );
  const average = completed.length
    ? total.dividedBy(completed.length)
    : new Prisma.Decimal(0);
  const paymentCounts = sales.reduce<Record<string, number>>((counts, sale) => {
    for (const payment of sale.payments) {
      counts[payment.paymentMethod] = (counts[payment.paymentMethod] ?? 0) + 1;
    }
    return counts;
  }, {});
  const paymentMethods = Object.entries(paymentCounts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5);
  const cards = [
    {
      label: "Sales total",
      value: money(total),
      note: `${completed.length} completed receipts`,
      icon: ShoppingBag,
      tone: "blue",
    },
    {
      label: "Invoices",
      value: sales.length.toLocaleString("en-PK"),
      note: "Recent receipts across your locations",
      icon: ReceiptText,
      tone: "orange",
    },
    {
      label: "Returns",
      value: returned.length.toLocaleString("en-PK"),
      note: "Refunded or partially returned receipts",
      icon: RotateCcw,
      tone: "rose",
    },
    {
      label: "Average order value",
      value: money(average),
      note: "Completed receipts only",
      icon: WalletCards,
      tone: "purple",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Sales"
        description="Track sales performance and manage receipts across your assigned locations."
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <MetricCard
            key={label}
            label={label}
            value={value}
            note={note}
            icon={<Icon className="size-6" />}
            tone={tone}
          />
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.5fr_.85fr]">
        <Panel
          title="Sales trend"
          description="Recent receipts, presented as a simple activity trend."
        >
          <div className="flex h-64 items-end gap-3 border-b px-4 pb-5">
            {Array.from({ length: 7 }, (_, index) => {
              const sale = completed[index];
              const height = sale
                ? Math.max(
                    15,
                    Math.min(
                      100,
                      sale.total
                        .dividedBy(total.eq(0) ? 1 : total)
                        .mul(450)
                        .toNumber(),
                    ),
                  )
                : 15;
              return (
                <div
                  key={index}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className="w-full rounded-t-md bg-blue-600/90"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-muted-foreground text-[10px]">
                    {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Payment methods"
          description="Distribution among recent sales."
        >
          {paymentMethods.length ? (
            <div className="space-y-4 px-1 py-4">
              {paymentMethods.map(([method, count], index) => (
                <div key={method}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-medium">
                      {method.replaceAll("_", " ")}
                    </span>
                    <span className="text-muted-foreground">
                      {count} receipt{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={
                        [
                          "bg-blue-600",
                          "bg-emerald-500",
                          "bg-orange-400",
                          "bg-violet-500",
                          "bg-slate-400",
                        ][index]
                      }
                      style={{
                        width: `${Math.max(10, (count / sales.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="Payment method data will appear after the first completed sale." />
          )}
        </Panel>
      </section>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel
          title="Recent sales / invoices"
          description="Open a receipt to view payments, items, returns, and audit history."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/45 text-muted-foreground text-xs">
                <tr>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Cashier</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sales.slice(0, 8).map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        className="text-primary hover:underline"
                        href={`/sales/${sale.id}`}
                      >
                        {sale.receiptNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {sale.customer?.name ?? "Walk-in customer"}
                    </td>
                    <td className="px-4 py-3">{sale.cashier.displayName}</td>
                    <td className="text-muted-foreground px-4 py-3">
                      {sale.completedAt
                        ? formatKarachiDateTime(sale.completedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <SaleStatus status={sale.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {money(sale.total)}
                    </td>
                  </tr>
                ))}
                {!sales.length ? (
                  <tr>
                    <td
                      className="text-muted-foreground p-10 text-center"
                      colSpan={6}
                    >
                      No sales found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Quick actions" description="Retail tasks.">
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/pos" icon={ShoppingBag} label="New sale" />
            <QuickAction
              href="/sales"
              icon={ReceiptText}
              label="View receipts"
            />
            <QuickAction
              href="/reports"
              icon={BarChart3}
              label="Sales reports"
            />
            <QuickAction href="/pos" icon={CreditCard} label="Take payment" />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: "blue" | "orange" | "rose" | "purple";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    rose: "bg-rose-50 text-rose-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <article className="bg-card rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
        <div>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </div>
      </div>
    </article>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SaleStatus({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    COMPLETED: "default",
    REFUNDED: "secondary",
    VOIDED: "destructive",
    DRAFT: "outline",
  };
  return (
    <Badge variant={variants[status] ?? "outline"}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof ShoppingBag;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bg-muted/50 hover:bg-muted flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl p-3 text-center text-xs font-medium transition-colors"
    >
      <Icon className="text-primary size-5" />
      {label}
    </Link>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <p className="text-muted-foreground p-10 text-center text-sm">{message}</p>
  );
}
