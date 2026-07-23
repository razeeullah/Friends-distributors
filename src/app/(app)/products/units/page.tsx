import Link from "next/link";

import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/session";
import { listUnits } from "@/features/products/queries";
import { ReferenceManager } from "@/features/products/reference-manager";

export default async function UnitsPage() {
  const context = await requirePermission("category.manage");
  const records = await listUnits(context.business.id);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Units"
        description="Manage quantity precision and product units."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/products/categories">Categories</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/products/brands">Brands</Link>
            </Button>
            <Button asChild>
              <Link href="/products/units">Units</Link>
            </Button>
          </div>
        }
      />
      <ReferenceManager
        kind="unit"
        records={records.map((record) => ({
          id: record.id,
          name: record.name,
          abbreviation: record.abbreviation,
          precision: record.precision,
          isActive: record.isActive,
          productCount: record._count.products,
        }))}
      />
    </div>
  );
}
