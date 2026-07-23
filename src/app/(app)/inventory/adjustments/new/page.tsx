import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { StockAdjustmentForm } from "@/features/inventory/stock-adjustment-form";
import {
  getAdjustmentProductOptions,
  getInventoryOptions,
} from "@/features/inventory/queries";

export default async function NewStockAdjustmentPage() {
  const context = await requirePermission("inventory.adjust");
  const locations = context.locations.map(({ id }) => id);
  const options = await getInventoryOptions(context.business.id, locations);
  const defaultLocationId =
    context.currentLocation?.id ?? options.locations[0]?.id ?? "";
  const locationSnapshots = await Promise.all(
    options.locations.map(
      async (location) =>
        [
          location.id,
          await getAdjustmentProductOptions(context.business.id, location.id),
        ] as const,
    ),
  );
  const variantsByLocation = Object.fromEntries(locationSnapshots);
  const variants = variantsByLocation[defaultLocationId] ?? [];
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Create stock adjustment"
        description="Drafts do not affect stock. Posting re-reads the current balance and writes permanent movements."
      />
      {options.locations.length === 0 || variants.length === 0 ? (
        <Alert variant="destructive">
          <AlertTitle>Inventory setup required</AlertTitle>
          <AlertDescription>
            An assigned active location and an active product variant are
            required.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <StockAdjustmentForm
            locations={options.locations}
            variantsByLocation={variantsByLocation}
            initialLocationId={defaultLocationId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
