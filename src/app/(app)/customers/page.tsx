import {
  CircleDollarSign,
  ClipboardList,
  Mail,
  Phone,
  Search,
  UserRoundPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { SaleStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const querySchema = z.object({
  search: z.string().trim().max(180).default(""),
});
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const money = (value: { toString(): string }) =>
  formatMoney(parseMoneyToMinor(value.toString()));

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("sale.view");
  const raw = await searchParams;
  const { search } = querySchema.parse({ search: single(raw.search) });
  const locationIds = context.locations.map((location) => location.id);
  const customerWhere = {
    businessId: context.business.id,
    archivedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [customers, totalCustomers, activeCustomers, receivables] =
    await Promise.all([
      db.customer.findMany({
        where: customerWhere,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        take: 100,
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          isActive: true,
          sales: {
            where: {
              locationId: { in: locationIds },
              status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] },
            },
            orderBy: { completedAt: "desc" },
            take: 1,
            select: { completedAt: true, total: true, balance: true },
          },
          _count: {
            select: {
              sales: {
                where: {
                  locationId: { in: locationIds },
                  status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] },
                },
              },
            },
          },
        },
      }),
      db.customer.count({
        where: { businessId: context.business.id, archivedAt: null },
      }),
      db.customer.count({
        where: {
          businessId: context.business.id,
          archivedAt: null,
          isActive: true,
        },
      }),
      db.sale.aggregate({
        where: {
          businessId: context.business.id,
          locationId: { in: locationIds },
          customerId: { not: null },
          status: SaleStatus.COMPLETED,
        },
        _sum: { balance: true },
      }),
    ]);
  const repeatBuyers = customers.filter(
    (customer) => customer._count.sales > 1,
  ).length;
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Customers"
        description="Manage customer relationships and view purchase history across your assigned locations."
        actions={
          <Button asChild>
            <Link href="/pos">
              <UserRoundPlus /> New customer
            </Link>
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetric
          label="Total customers"
          value={totalCustomers.toLocaleString("en-PK")}
          detail="Active customer directory"
          icon={<Users className="size-6" />}
          tone="blue"
        />
        <CustomerMetric
          label="Active customers"
          value={activeCustomers.toLocaleString("en-PK")}
          detail="Available for new sales"
          icon={<UserRoundPlus className="size-6" />}
          tone="green"
        />
        <CustomerMetric
          label="Total receivables"
          value={money(receivables._sum.balance ?? 0)}
          detail="Outstanding completed-sale balances"
          icon={<CircleDollarSign className="size-6" />}
          tone="orange"
        />
        <CustomerMetric
          label="Repeat buyers"
          value={repeatBuyers.toLocaleString("en-PK")}
          detail="In the current customer view"
          icon={<ClipboardList className="size-6" />}
          tone="purple"
        />
      </section>
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">All customers</h2>
              <p className="text-muted-foreground text-xs">
                Customer data and sales totals are location scoped.
              </p>
            </div>
            <form method="get" className="relative w-full sm:w-80">
              <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
              <Input
                name="search"
                defaultValue={search}
                className="h-10 pl-9"
                placeholder="Search name, phone, email, or code…"
                aria-label="Search customers"
              />
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-muted/45 text-muted-foreground text-xs">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 font-medium">Outstanding balance</th>
                  <th className="px-4 py-3 font-medium">Last purchase</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customers.map((customer) => {
                  const lastSale = customer.sales[0];
                  return (
                    <tr key={customer.id} className="hover:bg-muted/25">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                            {customer.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {customer.code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1.5">
                          {customer.phone ? (
                            <>
                              <Phone className="text-muted-foreground size-3.5" />
                              {customer.phone}
                            </>
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                          {customer.email ? (
                            <>
                              <Mail className="size-3.5" />
                              {customer.email}
                            </>
                          ) : (
                            ""
                          )}
                        </p>
                      </td>
                      <td className="text-muted-foreground max-w-48 truncate px-4 py-3">
                        {customer.address ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-orange-700">
                        {money(lastSale?.balance ?? 0)}
                      </td>
                      <td className="text-muted-foreground px-4 py-3">
                        {lastSale?.completedAt
                          ? formatKarachiDateTime(lastSale.completedAt)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{customer._count.sales}</td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={customer.isActive ? "default" : "secondary"}
                        >
                          {customer.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {!customers.length ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-muted-foreground p-12 text-center"
                    >
                      No customers match this search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "purple";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    purple: "bg-violet-50 text-violet-600",
  };
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-3 ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tracking-tight">
            {value}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
