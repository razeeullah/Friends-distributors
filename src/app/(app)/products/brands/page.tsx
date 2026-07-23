import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/session";
import { listBrands } from "@/features/products/queries";
import { ReferenceManager } from "@/features/products/reference-manager";

export default async function BrandsPage() {
  const context = await requirePermission("category.manage");
  const records = await listBrands(context.business.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Brands"
        description="Manage optional product brands."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/products/categories">Categories</Link>
            </Button>
            <Button asChild>
              <Link href="/products/brands">Brands</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/products/units">Units</Link>
            </Button>
          </div>
        }
      />
      <ReferenceManager
        kind="brand"
        records={records.map((record) => ({
          id: record.id,
          name: record.name,
          description: record.description,
          isActive: record.isActive,
          productCount: record._count.products,
        }))}
      />
    </div>
  );
}
