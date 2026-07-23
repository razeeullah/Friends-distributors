import type { Metadata } from "next";

import { PageTitle } from "@/components/layout/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { ProductForm } from "@/features/products/product-form";
import { getCatalogOptions } from "@/features/products/queries";

export const metadata: Metadata = { title: "Create product" };

export default async function CreateProductPage() {
  const context = await requirePermission("product.create");
  const options = await getCatalogOptions(context.business.id);
  const missingReferences =
    options.categories.length === 0 || options.units.length === 0;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Create product"
        description="Create the product and its variants. Opening stock must be entered through an inventory workflow."
      />
      {missingReferences ? (
        <Alert variant="destructive">
          <AlertTitle>Catalog setup required</AlertTitle>
          <AlertDescription>
            Create at least one active category and unit before creating a
            product.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <ProductForm
            mode="create"
            categories={options.categories}
            brands={options.brands}
            units={options.units}
            initialValues={{
              name: "",
              description: "",
              sku: "",
              categoryId: options.categories[0]?.id ?? "",
              brandId: "",
              unitId: options.units[0]?.id ?? "",
              taxable: true,
              taxRate: "0",
              trackInventory: true,
              allowNegativeStock: false,
              minimumStock: "0",
              isActive: true,
              variants: [
                {
                  name: "Default",
                  sku: "",
                  barcode: "",
                  size: "",
                  color: "",
                  costPrice: "0.00",
                  sellingPrice: "0.00",
                  minimumStock: "0",
                  isActive: true,
                },
              ],
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
