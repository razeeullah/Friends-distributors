import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { ProductForm } from "@/features/products/product-form";
import {
  getCatalogOptions,
  getProductDetails,
} from "@/features/products/queries";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const context = await requirePermission("product.update");
  const { productId } = await params;
  const locationId = context.currentLocation?.id ?? context.locations[0]?.id;
  if (!locationId) notFound();
  const [product, options] = await Promise.all([
    getProductDetails(context.business.id, productId, locationId),
    getCatalogOptions(context.business.id),
  ]);
  if (product === null || product.archivedAt !== null) notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title={`Edit ${product.name}`}
        description="Prices and product metadata may be edited here; current stock remains read-only."
      />
      <Card>
        <CardContent>
          <ProductForm
            mode="edit"
            productId={product.id}
            categories={options.categories}
            brands={options.brands}
            units={options.units}
            initialValues={{
              name: product.name,
              description: product.description ?? "",
              sku: product.sku,
              categoryId: product.category.id,
              brandId: product.brand?.id ?? "",
              unitId: product.unit.id,
              taxable: product.taxable,
              taxRate: product.taxRate,
              trackInventory: product.trackInventory,
              allowNegativeStock: product.allowNegativeStock,
              minimumStock: product.minimumStock,
              isActive: product.isActive,
              variants: product.variants
                .filter(({ archivedAt }) => archivedAt === null)
                .map((variant) => ({
                  id: variant.id,
                  name: variant.name,
                  sku: variant.sku,
                  barcode: variant.barcodes[0]?.barcode ?? "",
                  size: variant.size ?? "",
                  color: variant.color ?? "",
                  costPrice: variant.costPrice,
                  sellingPrice: variant.sellingPrice,
                  minimumStock: variant.minimumStock,
                  isActive: variant.isActive,
                })),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
