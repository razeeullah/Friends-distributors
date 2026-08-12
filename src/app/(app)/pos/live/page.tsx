import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requirePermission } from "@/features/auth/session";
import { getPosData } from "@/features/sales/queries";
import { PosTerminal } from "@/features/sales/pos-terminal";

/** The original database-backed POS terminal is retained for operational testing. */
export default async function LivePosPage() {
  const context = await requirePermission("sale.create");
  const data = await getPosData(
    context.business.id,
    context.currentLocation?.id ?? null,
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle
        title="Live POS terminal"
        description="Database-backed checkout with register-session validation."
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
