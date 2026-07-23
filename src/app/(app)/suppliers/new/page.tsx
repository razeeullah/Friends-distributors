import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { SupplierForm } from "@/features/purchases/supplier-form";

export default async function NewSupplierPage() {
  await requirePermission("supplier.manage");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle
        title="Create supplier"
        description="Add contact, tax, payment terms, and opening payable information."
      />
      <Card>
        <CardContent>
          <SupplierForm
            initialValues={{
              code: "",
              name: "",
              contactName: "",
              email: "",
              phone: "",
              address: "",
              taxRegistrationNumber: "",
              paymentTermsDays: 0,
              openingBalance: "0.00",
              isActive: true,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
