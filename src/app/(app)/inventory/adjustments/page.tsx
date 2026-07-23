import { Plus } from "lucide-react";
import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import {
  getInventoryOptions,
  listStockAdjustments,
} from "@/features/inventory/queries";
import { StockAdjustmentStatus } from "@/generated/prisma/enums";
import { formatKarachiDateTime } from "@/lib/dates";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const context = await requirePermission("inventory.view");
  const raw = await searchParams;
  const locationId = single(raw.locationId);
  if (locationId) await requireLocationAccess(locationId);
  const locationIds = context.locations.map(({ id }) => id);
  const [{ items, query }, options] = await Promise.all([
    listStockAdjustments(context.business.id, locationIds, {
      locationId,
      status: single(raw.status),
      page: single(raw.page),
    }),
    getInventoryOptions(context.business.id, locationIds),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Stock adjustments"
        description="Draft and completed inventory corrections."
        actions={
          context.permissions.has("inventory.adjust") ? (
            <Button asChild>
              <Link href="/inventory/adjustments/new">
                <Plus /> Create adjustment
              </Link>
            </Button>
          ) : null
        }
      />
      <Card>
        <CardContent>
          <form method="get" className="flex flex-wrap gap-3">
            <select
              name="locationId"
              defaultValue={query.locationId ?? ""}
              aria-label="Location"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All locations</option>
              {options.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={query.status ?? ""}
              aria-label="Status"
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All statuses</option>
              {Object.values(StockAdjustmentStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit">Filter</Button>
            <Button asChild variant="outline">
              <Link href="/inventory/adjustments">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto px-0">
          {items.length === 0 ? (
            <p className="p-16 text-center text-sm">No adjustments found.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Adjustment</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium">{item.adjustmentNumber}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.reason}
                      </p>
                    </td>
                    <td className="px-4 py-4">{item.location.name}</td>
                    <td className="px-4 py-4">{item.adjustmentType}</td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          item.status === "COMPLETED" ? "default" : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{item.itemCount}</td>
                    <td className="px-4 py-4">
                      {formatKarachiDateTime(item.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/inventory/adjustments/${item.id}`}>
                          View
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
    </div>
  );
}
