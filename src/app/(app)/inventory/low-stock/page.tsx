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
  listInventory,
} from "@/features/inventory/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function LowStockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("inventory.view");
  const raw = await searchParams;
  const requestedLocation = single(raw.locationId);
  if (requestedLocation) await requireLocationAccess(requestedLocation);
  const location =
    context.locations.find(({ id }) => id === requestedLocation) ??
    context.currentLocation;
  if (!location)
    return (
      <div>
        <PageTitle
          title="Low-stock report"
          description="Assign a location to view this report."
        />
      </div>
    );
  const [{ items }, options] = await Promise.all([
    listInventory(context.business.id, location.id, {
      search: single(raw.search),
      categoryId: single(raw.categoryId),
      stockStatus: "low_stock",
      pageSize: 100,
    }),
    getInventoryOptions(
      context.business.id,
      context.locations.map(({ id }) => id),
    ),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Low-stock report"
        description={`Variants at or below their minimum quantity in ${location.name}.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/inventory">Current inventory</Link>
          </Button>
        }
      />
      <Card>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-4">
            <select
              name="locationId"
              defaultValue={location.id}
              aria-label="Location"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              {options.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="categoryId"
              defaultValue={single(raw.categoryId) ?? ""}
              aria-label="Category"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All categories</option>
              {options.categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              name="search"
              defaultValue={single(raw.search) ?? ""}
              placeholder="Product, SKU or barcode"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            />
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <p className="p-16 text-center text-sm">
              No low-stock variants in this location.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">Minimum</th>
                  <th className="px-6 py-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.productVariantId}>
                    <td className="px-6 py-4">
                      <p className="font-medium">
                        {item.productName} — {item.variantName}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {item.sku}
                      </p>
                    </td>
                    <td className="px-4 py-4">{item.categoryName}</td>
                    <td className="px-4 py-4">{item.quantity}</td>
                    <td className="px-4 py-4">{item.minimumQuantity}</td>
                    <td className="px-6 py-4 text-right">
                      {formatMoney(parseMoneyToMinor(item.inventoryValue))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
