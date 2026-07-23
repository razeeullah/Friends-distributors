import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getSupplierDetails } from "@/features/purchases/queries";
import { SupplierForm } from "@/features/purchases/supplier-form";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const context = await requirePermission("supplier.manage");
  const { supplierId } = await params;
  const supplier = await getSupplierDetails(context.business.id, supplierId);
  if (!supplier) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle title={`Edit ${supplier.name}`} />
      <Card>
        <CardContent>
          <SupplierForm
            initialValues={{
              id: supplier.id,
              code: supplier.code,
              name: supplier.name,
              contactName: supplier.contactName ?? "",
              email: supplier.email ?? "",
              phone: supplier.phone ?? "",
              address: supplier.address ?? "",
              taxRegistrationNumber: supplier.taxRegistrationNumber ?? "",
              paymentTermsDays: supplier.paymentTermsDays,
              openingBalance: supplier.openingBalance,
              isActive: supplier.isActive,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
