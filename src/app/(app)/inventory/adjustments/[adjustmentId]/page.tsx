import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { PostAdjustmentButton } from "@/features/inventory/post-adjustment-button";
import { getStockAdjustmentDetails } from "@/features/inventory/queries";
import { StockAdjustmentStatus } from "@/generated/prisma/enums";
import { formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

export default async function StockAdjustmentDetailsPage({
  params,
}: {
  params: Promise<{ adjustmentId: string }>;
}) {
  const context = await requirePermission("inventory.view");
  const { adjustmentId } = await params;
  const adjustment = await getStockAdjustmentDetails(
    context.business.id,
    context.locations.map(({ id }) => id),
    adjustmentId,
  );
  if (!adjustment) notFound();
  const canPost =
    context.permissions.has("inventory.adjust") &&
    adjustment.status === StockAdjustmentStatus.DRAFT;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title={adjustment.adjustmentNumber}
        description={`${adjustment.location.name} · ${adjustment.reason}`}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                adjustment.status === "COMPLETED" ? "default" : "secondary"
              }
            >
              {adjustment.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Direction</CardTitle>
          </CardHeader>
          <CardContent className="font-semibold">
            {adjustment.adjustmentType === "INCREASE"
              ? "Adjustment in"
              : "Adjustment out"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Created</CardTitle>
          </CardHeader>
          <CardContent>
            {formatKarachiDateTime(adjustment.createdAt)}
          </CardContent>
        </Card>
      </div>
      {canPost ? (
        <Card>
          <CardHeader>
            <CardTitle>Post adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Posting is irreversible. Create a separate correcting adjustment
              if this count is wrong.
            </p>
            <PostAdjustmentButton adjustmentId={adjustment.id} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Adjustment items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-4 py-3">System</th>
                <th className="px-4 py-3">Counted</th>
                <th className="px-4 py-3">Difference</th>
                <th className="px-6 py-3 text-right">Stored cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {adjustment.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <p className="font-medium">
                      {item.productVariant.product.name} —{" "}
                      {item.productVariant.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.productVariant.sku}
                    </p>
                  </td>
                  <td className="px-4 py-4">{item.systemQuantity}</td>
                  <td className="px-4 py-4">{item.countedQuantity}</td>
                  <td className="px-4 py-4">{item.quantityChange}</td>
                  <td className="px-6 py-4 text-right">
                    {item.unitCost
                      ? formatMoney(parseMoneyToMinor(item.unitCost))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notes and completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{adjustment.notes ?? "No notes."}</p>
          <p className="text-muted-foreground">
            Created by {adjustment.createdBy.displayName}.{" "}
            {adjustment.completedAt
              ? `Completed ${formatKarachiDateTime(adjustment.completedAt)} by ${adjustment.completedBy?.displayName ?? "—"}.`
              : "Not posted yet."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
