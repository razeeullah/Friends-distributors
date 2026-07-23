import {
  Boxes,
  ClipboardPlus,
  Factory,
  History,
  PackageCheck,
  Search,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import {
  getInventoryValuation,
  getInventoryOptions,
  listInventory,
} from "@/features/inventory/queries";
import { formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const money = (value: string) => formatMoney(parseMoneyToMinor(value));

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("inventory.view");
  const raw = await searchParams;
  const requestedLocationId = single(raw.locationId);
  if (requestedLocationId) await requireLocationAccess(requestedLocationId);
  const location =
    context.locations.find(({ id }) => id === requestedLocationId) ??
    context.currentLocation;
  if (!location)
    return (
      <div className="mx-auto max-w-7xl">
        <PageTitle
          title="Inventory"
          description="A location assignment is required to view inventory."
        />
      </div>
    );
  const [{ items, query, pagination }, options, valuation, lowStock] =
    await Promise.all([
      listInventory(context.business.id, location.id, {
        search: single(raw.search),
        categoryId: single(raw.categoryId),
        stockStatus: single(raw.stockStatus),
        page: single(raw.page),
      }),
      getInventoryOptions(
        context.business.id,
        context.locations.map(({ id }) => id),
      ),
      getInventoryValuation(context.business.id, location.id),
      listInventory(context.business.id, location.id, {
        stockStatus: "low_stock",
        page: "1",
        pageSize: "1",
      }),
    ]);
  const canAdjust = context.permissions.has("inventory.adjust");
  const stockStatus = (item: (typeof items)[number]) => {
    if (Number(item.quantity) <= 0) return "Out of stock";
    if (Number(item.quantity) <= Number(item.minimumQuantity))
      return "Low stock";
    return "In stock";
  };
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <PageTitle
        title="Inventory"
        description={`Manage stock, track availability, and monitor inventory at ${location.name}.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/inventory/movements">
                <History /> Movements
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory/low-stock">
                <TriangleAlert /> Low stock
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/inventory/valuation">
                <WalletCards /> Valuation
              </Link>
            </Button>
            {canAdjust ? (
              <Button asChild>
                <Link href="/inventory/adjustments/new">
                  <ClipboardPlus /> Stock adjustment
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryMetric
          label="Total stock value"
          value={money(valuation.totalValue)}
          detail={`Across ${valuation.categories.length} categories`}
          icon={<WalletCards className="size-6" />}
          tone="blue"
        />
        <InventoryMetric
          label="Active SKUs"
          value={pagination.totalItems.toLocaleString("en-PK")}
          detail="Matching the current filters"
          icon={<Boxes className="size-6" />}
          tone="green"
        />
        <InventoryMetric
          label="Low-stock items"
          value={lowStock.pagination.totalItems.toLocaleString("en-PK")}
          detail="Need replenishment attention"
          icon={<TriangleAlert className="size-6" />}
          tone="orange"
        />
        <InventoryMetric
          label="Locations"
          value={options.locations.length.toLocaleString("en-PK")}
          detail={`${location.name} selected`}
          icon={<Factory className="size-6" />}
          tone="purple"
        />
      </section>
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-3">
          <form
            method="get"
            className="grid gap-2 lg:grid-cols-[minmax(15rem,1.5fr)_repeat(3,minmax(9rem,1fr))_auto]"
          >
            <div className="relative">
              <Search className="text-muted-foreground absolute top-3 left-3 size-4" />
              <Input
                name="search"
                defaultValue={query.search}
                className="h-10 pl-9"
                placeholder="Search by product name, SKU, or barcode…"
                aria-label="Search inventory"
              />
            </div>
            <select
              name="locationId"
              defaultValue={location.id}
              aria-label="Location"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              {options.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="categoryId"
              defaultValue={query.categoryId ?? ""}
              aria-label="Category"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="">All categories</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              name="stockStatus"
              defaultValue={query.stockStatus}
              aria-label="Stock status"
              className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            >
              <option value="all">All stock</option>
              <option value="in_stock">In stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="low_stock">Low stock</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="rounded-lg">
                Filter
              </Button>
              <Button asChild variant="outline">
                <Link href="/inventory">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <div className="p-16 text-center">
              <p className="font-medium">No inventory found</p>
              <p className="text-muted-foreground text-sm">
                Adjust the filters or receive stock.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/45 text-muted-foreground text-xs">
                <tr>
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Current quantity</th>
                  <th className="px-4 py-3 font-medium">Minimum</th>
                  <th className="px-4 py-3 font-medium">Cost price</th>
                  <th className="px-4 py-3 font-medium">Inventory value</th>
                  <th className="px-4 py-3 font-medium">Stock status</th>
                  <th className="px-6 py-3 font-medium">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.productVariantId} className="hover:bg-muted/25">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-stone-200">
                          <PackageCheck className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.productName} — {item.variantName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {item.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">{item.categoryName}</td>
                    <td className="px-4 py-4">{item.quantity}</td>
                    <td className="px-4 py-4">{item.minimumQuantity}</td>
                    <td className="px-4 py-4">{money(item.unitCost)}</td>
                    <td className="px-4 py-4 font-medium">
                      {money(item.inventoryValue)}
                    </td>
                    <td className="px-4 py-4">
                      <StockBadge status={stockStatus(item)} />
                    </td>
                    <td className="px-6 py-4">
                      {item.lastMovementAt
                        ? formatKarachiDateTime(item.lastMovementAt)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {pagination.totalPages > 1 ? (
        <div className="bg-card flex items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm">
          <span className="text-muted-foreground">
            Showing page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={!pagination.hasPreviousPage}
            >
              <Link
                href={`/inventory?page=${Math.max(1, pagination.page - 1)}`}
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
              <Link href={`/inventory?page=${pagination.page + 1}`}>Next</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InventoryMetric({
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

function StockBadge({ status }: { status: string }) {
  const classes = {
    "In stock": "bg-emerald-50 text-emerald-700",
    "Low stock": "bg-amber-50 text-amber-700",
    "Out of stock": "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${classes[status as keyof typeof classes]}`}
    >
      {status}
    </span>
  );
}
