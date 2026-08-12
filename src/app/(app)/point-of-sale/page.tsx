import { requirePermission } from "@/features/auth/session";
import { PointOfSaleDemo } from "@/features/point-of-sale/point-of-sale-demo";

export default async function PointOfSaleDemoPage() {
  await requirePermission("sale.create");
  return <PointOfSaleDemo />;
}
