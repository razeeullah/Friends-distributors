import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { getPurchaseOptions } from "@/features/purchases/queries";
import { toKarachiDateKey } from "@/lib/dates";

export default async function NewPurchasePage() {
  const context = await requirePermission("purchase.create");
  const options = await getPurchaseOptions(
    context.business.id,
    context.locations.map(({ id }) => id),
  );
  const unavailable =
    options.suppliers.length === 0 ||
    options.locations.length === 0 ||
    options.variants.length === 0;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title="Create purchase"
        description="Save a draft first. Inventory changes only when stock is received."
      />
      {unavailable ? (
        <Alert variant="destructive">
          <AlertTitle>Purchase setup required</AlertTitle>
          <AlertDescription>
            An active supplier, assigned location, and active product variant
            are required.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <PurchaseForm
            mode="create"
            suppliers={options.suppliers}
            locations={options.locations}
            variants={options.variants}
            initialValues={{
              supplierId: options.suppliers[0]?.id ?? "",
              locationId:
                context.currentLocation?.id ?? options.locations[0]?.id ?? "",
              supplierInvoiceNumber: "",
              purchaseDate: toKarachiDateKey(new Date()),
              notes: "",
              items: [],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
