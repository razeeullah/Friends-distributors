import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import {
  getInventoryOptions,
  listStockMovements,
} from "@/features/inventory/queries";
import {
  StockMovementType,
  StockReferenceType,
} from "@/generated/prisma/enums";
import { formatKarachiDateTime } from "@/lib/dates";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function MovementLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("inventory.view");
  const raw = await searchParams;
  const locationId = single(raw.locationId);
  if (locationId) await requireLocationAccess(locationId);
  const locationIds = context.locations.map(({ id }) => id);
  const [{ items, query, pagination }, options] = await Promise.all([
    listStockMovements(context.business.id, locationIds, {
      locationId,
      productVariantId: single(raw.productVariantId),
      movementType: single(raw.movementType),
      referenceType: single(raw.referenceType),
      dateFrom: single(raw.dateFrom),
      dateTo: single(raw.dateTo),
      page: single(raw.page),
    }),
    getInventoryOptions(context.business.id, locationIds),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Stock movement ledger"
        description="Immutable inventory activity across your authorized locations."
      />
      <Card>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 md:grid-cols-4 xl:grid-cols-6"
          >
            <input
              type="date"
              name="dateFrom"
              defaultValue={query.dateFrom ?? ""}
              aria-label="From date"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
            <input
              type="date"
              name="dateTo"
              defaultValue={query.dateTo ?? ""}
              aria-label="To date"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
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
            <select
              name="productVariantId"
              defaultValue={query.productVariantId ?? ""}
              aria-label="Product"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All products</option>
              {options.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label} · {variant.sku}
                </option>
              ))}
            </select>
            <select
              name="movementType"
              defaultValue={query.movementType ?? ""}
              aria-label="Movement type"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All movement types</option>
              {Object.values(StockMovementType).map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <select
              name="referenceType"
              defaultValue={query.referenceType ?? ""}
              aria-label="Reference type"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All reference types</option>
              {Object.values(StockReferenceType).map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-4 xl:col-span-6">
              <Button type="submit">Filter</Button>
              <Button asChild variant="outline">
                <Link href="/inventory/movements">Clear</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <p className="p-16 text-center text-sm">
              No stock movements found.
            </p>
          ) : (
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Before</th>
                  <th className="px-4 py-3">Change</th>
                  <th className="px-4 py-3">After</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-6 py-3">Reference / notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      {formatKarachiDateTime(item.occurredAt)}
                    </td>
                    <td className="px-4 py-4">
                      <p>
                        {item.productVariant.product.name} —{" "}
                        {item.productVariant.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.productVariant.sku}
                      </p>
                    </td>
                    <td className="px-4 py-4">{item.location.name}</td>
                    <td className="px-4 py-4">
                      {item.movementType.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-4">{item.quantityBefore}</td>
                    <td className="px-4 py-4">{item.quantityChange}</td>
                    <td className="px-4 py-4">{item.quantityAfter}</td>
                    <td className="px-4 py-4">
                      {item.performedBy.displayName}
                    </td>
                    <td className="px-6 py-4">
                      <p>
                        {item.referenceType.replaceAll("_", " ")} ·{" "}
                        {item.referenceId.slice(0, 8)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.notes ?? "—"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {pagination.totalPages > 1 ? (
        <p className="text-sm">
          Page {pagination.page} of {pagination.totalPages}
        </p>
      ) : null}
    </div>
  );
}
