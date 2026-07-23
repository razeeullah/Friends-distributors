import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PosTerminal } from "@/features/sales/pos-terminal";
import { getPosData } from "@/features/sales/queries";
import { requirePermission } from "@/features/auth/session";

export default async function PosPage() {
  const context = await requirePermission("sale.create");
  const data = await getPosData(
    context.business.id,
    context.currentLocation?.id ?? null,
  );
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle
        title="Point of Sale"
        description="Search products, scan barcodes, and complete secure register sales."
      />
      {!data.registerSession ? (
        <Alert>
          <AlertTitle>Register session required</AlertTitle>
          <AlertDescription>
            Open a register session before checkout. Products and cart controls
            remain available for preparation.
          </AlertDescription>
        </Alert>
      ) : null}
      <PosTerminal
        data={data}
        canDiscount={context.permissions.has("sale.discount")}
        canOverridePrice={context.permissions.has("sale.override_price")}
        canCreateCustomer={context.permissions.has("customer.create")}
      />
    </div>
  );
}
