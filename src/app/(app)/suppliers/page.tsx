import {
  CircleDollarSign,
  ClipboardList,
  Eye,
  Plus,
  Search,
  Truck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/features/auth/session";
import { listSuppliers } from "@/features/purchases/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("supplier.manage");
  const raw = await searchParams;
  const { items, query, pagination } = await listSuppliers(
    context.business.id,
    {
      search: single(raw.search),
      status: single(raw.status),
      page: single(raw.page),
    },
  );
  const visiblePayable = items.reduce(
    (sum, supplier) => sum.add(supplier.payableBalance),
    new Prisma.Decimal(0),
  );
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Suppliers"
        description="Supplier contacts, purchase activity, and payable balances."
        actions={
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus /> Create supplier
            </Link>
          </Button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SupplierMetric
          label="Total suppliers"
          value={pagination.totalItems.toLocaleString("en-PK")}
          detail="Matching the selected filters"
          icon={<UsersRound className="size-6" />}
          tone="blue"
        />
        <SupplierMetric
          label="Active suppliers"
          value={items
            .filter((supplier) => supplier.isActive)
            .length.toLocaleString("en-PK")}
          detail="On the current page"
          icon={<Truck className="size-6" />}
          tone="green"
        />
        <SupplierMetric
          label="Visible payable balance"
          value={formatMoney(parseMoneyToMinor(visiblePayable.toString()))}
          detail="Current page supplier balances"
          icon={<CircleDollarSign className="size-6" />}
          tone="orange"
        />
        <SupplierMetric
          label="Supplier records"
          value={items.length.toLocaleString("en-PK")}
          detail="Ready for purchasing activity"
          icon={<ClipboardList className="size-6" />}
          tone="purple"
        />
      </section>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3">
          <form
            method="get"
            className="grid gap-2 md:grid-cols-[minmax(16rem,1fr)_11rem_auto]"
          >
            <div className="relative">
              <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
              <Input
                name="search"
                defaultValue={query.search}
                className="h-10 pl-9"
                placeholder="Search supplier, code, email, or phone…"
                aria-label="Search suppliers"
              />
            </div>
            <select
              name="status"
              defaultValue={query.status}
              aria-label="Supplier status"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="rounded-lg">
                Filter
              </Button>
              <Button asChild variant="outline">
                <Link href="/suppliers">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <div className="p-16 text-center">
              <p className="font-medium">No suppliers found</p>
              <p className="text-muted-foreground text-sm">
                Create a supplier or adjust the filters.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-muted/45 text-xs">
                <tr className="text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payable</th>
                  <th className="px-6 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-muted/25">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 text-xs font-bold text-blue-700">
                          {supplier.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{supplier.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {supplier.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {supplier.contactName ??
                        supplier.email ??
                        supplier.phone ??
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={supplier.isActive ? "default" : "secondary"}
                      >
                        {supplier.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-orange-700">
                      {formatMoney(parseMoneyToMinor(supplier.payableBalance))}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`View ${supplier.name}`}
                      >
                        <Link href={`/suppliers/${supplier.id}`}>
                          <Eye />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={!pagination.hasPreviousPage}
            >
              <Link
                href={`/suppliers?page=${Math.max(1, pagination.page - 1)}&search=${encodeURIComponent(query.search)}&status=${query.status}`}
              >
                Previous
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
            >
              <Link
                href={`/suppliers?page=${pagination.page + 1}&search=${encodeURIComponent(query.search)}&status=${query.status}`}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SupplierMetric({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
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
