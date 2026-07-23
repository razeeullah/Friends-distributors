import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  requireLocationAccess,
  requirePermission,
} from "@/features/auth/session";
import {
  getInventoryOptions,
  getInventoryValuation,
} from "@/features/inventory/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function InventoryValuationPage({
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
          title="Inventory valuation"
          description="Assign a location to view valuation."
        />
      </div>
    );
  const [valuation, options] = await Promise.all([
    getInventoryValuation(context.business.id, location.id),
    getInventoryOptions(
      context.business.id,
      context.locations.map(({ id }) => id),
    ),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle
        title="Inventory valuation"
        description={`Current stored-cost valuation for ${location.name}.`}
      />
      <Card>
        <CardContent>
          <form method="get" className="flex gap-3">
            <select
              name="locationId"
              defaultValue={location.id}
              aria-label="Location"
              className="border-input bg-background h-9 min-w-56 rounded-md border px-3 text-sm"
            >
              {options.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm"
            >
              View valuation
            </button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Total inventory value</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {formatMoney(parseMoneyToMinor(valuation.totalValue))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Category totals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          {valuation.categories.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm">
              No inventory balance records for this location.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-6 py-3 text-right">Stored-cost value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {valuation.categories.map((row) => (
                  <tr key={row.categoryName}>
                    <td className="px-6 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-6 py-3 text-right">
                      {formatMoney(parseMoneyToMinor(row.value))}
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
