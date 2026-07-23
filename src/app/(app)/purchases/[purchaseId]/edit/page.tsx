import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import {
  getPurchaseDetails,
  getPurchaseOptions,
} from "@/features/purchases/queries";
import { PurchaseStatus } from "@/generated/prisma/enums";
import { toKarachiDateKey } from "@/lib/dates";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const context = await requirePermission("purchase.create");
  const { purchaseId } = await params;
  const locationIds = context.locations.map(({ id }) => id);
  const [purchase, options] = await Promise.all([
    getPurchaseDetails(context.business.id, locationIds, purchaseId),
    getPurchaseOptions(context.business.id, locationIds),
  ]);
  if (!purchase || purchase.status !== PurchaseStatus.DRAFT) notFound();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title={`Edit ${purchase.purchaseNumber}`}
        description="Only draft purchases can be edited."
      />
      <Card>
        <CardContent>
          <PurchaseForm
            mode="edit"
            purchaseId={purchase.id}
            suppliers={options.suppliers}
            locations={options.locations}
            variants={options.variants}
            initialValues={{
              supplierId: purchase.supplier.id,
              locationId: purchase.location.id,
              supplierInvoiceNumber: purchase.supplierInvoiceNumber ?? "",
              purchaseDate: toKarachiDateKey(purchase.purchaseDate),
              notes: purchase.notes ?? "",
              items: purchase.items.map((item) => ({
                productVariantId: item.productVariant.id,
                quantity: item.quantity,
                unitCost: item.unitCost,
                discount: item.discount,
                tax: item.tax,
              })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
