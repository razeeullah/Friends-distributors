import { Plus } from "lucide-react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import {
  getPurchaseOptions,
  listPurchases,
} from "@/features/purchases/queries";
import { PurchaseStatus } from "@/generated/prisma/enums";
import { formatKarachiDate } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const money = (value: string) => formatMoney(parseMoneyToMinor(value));

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("purchase.view");
  const raw = await searchParams;
  const locationId = single(raw.locationId);
  if (locationId) await requireLocationAccess(locationId);
  const locationIds = context.locations.map(({ id }) => id);
  const [{ items, query, pagination }, options] = await Promise.all([
    listPurchases(context.business.id, locationIds, {
      search: single(raw.search),
      status: single(raw.status),
      supplierId: single(raw.supplierId),
      locationId,
      page: single(raw.page),
    }),
    getPurchaseOptions(context.business.id, locationIds),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Purchases"
        description="Draft, order, receive, and pay supplier purchases."
        actions={
          context.permissions.has("purchase.create") ? (
            <Button asChild>
              <Link href="/purchases/new">
                <Plus /> New purchase
              </Link>
            </Button>
          ) : null
        }
      />
      <Card>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-5">
            <Input
              name="search"
              defaultValue={query.search}
              placeholder="Purchase, invoice or supplier"
              aria-label="Search purchases"
            />
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label="Purchase status"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All statuses</option>
              {Object.values(PurchaseStatus).map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="supplierId"
              defaultValue={query.supplierId ?? ""}
              aria-label="Supplier"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All suppliers</option>
              {options.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              name="locationId"
              defaultValue={query.locationId ?? ""}
              aria-label="Location"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All locations</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button asChild variant="outline">
                <Link href="/purchases">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <div className="p-16 text-center">
              <p className="font-medium">No purchases found</p>
              <p className="text-muted-foreground text-sm">
                Create a draft or adjust the filters.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Purchase</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium">{purchase.purchaseNumber}</p>
                      <p className="text-muted-foreground text-xs">
                        {purchase.itemCount} items
                      </p>
                    </td>
                    <td className="px-4 py-4">{purchase.supplier.name}</td>
                    <td className="px-4 py-4">{purchase.location.name}</td>
                    <td className="px-4 py-4">
                      {formatKarachiDate(purchase.purchaseDate)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          purchase.status === "CANCELLED"
                            ? "destructive"
                            : purchase.status === "RECEIVED"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {purchase.status.replaceAll("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{money(purchase.total)}</td>
                    <td className="px-4 py-4">{money(purchase.balance)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/purchases/${purchase.id}`}>View</Link>
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
        <div className="flex justify-between text-sm">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={!pagination.hasPreviousPage}
            >
              <Link
                href={`/purchases?page=${Math.max(1, pagination.page - 1)}`}
              >
                Previous
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={!pagination.hasNextPage}
            >
              <Link href={`/purchases?page=${pagination.page + 1}`}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
