import Link from "next/link";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import {
  PurchasePaymentForm,
  PurchaseStateActions,
  ReceivePurchaseForm,
} from "@/features/purchases/purchase-actions";
import { getPurchaseDetails } from "@/features/purchases/queries";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseStatus } from "@/generated/prisma/enums";
import { formatKarachiDate, formatKarachiDateTime } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

const money = (value: string) => formatMoney(parseMoneyToMinor(value));

export default async function PurchaseDetailsPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const context = await requirePermission("purchase.view");
  const { purchaseId } = await params;
  const purchase = await getPurchaseDetails(
    context.business.id,
    context.locations.map(({ id }) => id),
    purchaseId,
  );
  if (!purchase) notFound();
  const canCreate = context.permissions.has("purchase.create");
  const canReceive = context.permissions.has("purchase.receive");
  const isReceivable =
    purchase.status === PurchaseStatus.ORDERED ||
    purchase.status === PurchaseStatus.PARTIALLY_RECEIVED;
  const receivedAny = purchase.items.some(
    (item) => !new Prisma.Decimal(item.receivedQuantity).isZero(),
  );
  const receivableItems = purchase.items
    .map((item) => ({
      id: item.id,
      label: `${item.productVariant.product.name} — ${item.productVariant.name}`,
      ordered: item.quantity,
      received: item.receivedQuantity,
      remaining: new Prisma.Decimal(item.quantity)
        .sub(item.receivedQuantity)
        .toString(),
    }))
    .filter((item) => !new Prisma.Decimal(item.remaining).isZero());

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title={purchase.purchaseNumber}
        description={`${purchase.supplier.name} · ${purchase.location.name}`}
        actions={
          purchase.status === PurchaseStatus.DRAFT && canCreate ? (
            <Button asChild variant="outline">
              <Link href={`/purchases/${purchase.id}/edit`}>Edit draft</Link>
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                purchase.status === PurchaseStatus.CANCELLED
                  ? "destructive"
                  : purchase.status === PurchaseStatus.RECEIVED
                    ? "default"
                    : "secondary"
              }
            >
              {purchase.status.replaceAll("_", " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(purchase.total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(purchase.paidAmount)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {money(purchase.balance)}
          </CardContent>
        </Card>
      </div>
      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>Purchase actions</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseStateActions
              purchaseId={purchase.id}
              canOrder={purchase.status === PurchaseStatus.DRAFT}
              canCancel={
                !receivedAny &&
                (purchase.status === PurchaseStatus.DRAFT ||
                  purchase.status === PurchaseStatus.ORDERED)
              }
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Purchase information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Supplier invoice:</span>{" "}
            {purchase.supplierInvoiceNumber ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Purchase date:</span>{" "}
            {formatKarachiDate(purchase.purchaseDate)}
          </p>
          <p>
            <span className="text-muted-foreground">Created by:</span>{" "}
            {purchase.createdBy.displayName}
          </p>
          <p>
            <span className="text-muted-foreground">Ordered:</span>{" "}
            {purchase.orderedAt
              ? formatKarachiDateTime(purchase.orderedAt)
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Latest receipt:</span>{" "}
            {purchase.receivedAt
              ? formatKarachiDateTime(purchase.receivedAt)
              : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Received by:</span>{" "}
            {purchase.receivedBy?.displayName ?? "—"}
          </p>
          <p className="md:col-span-3">
            <span className="text-muted-foreground">Notes:</span>{" "}
            {purchase.notes ?? "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-4 py-3">Ordered</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Unit cost</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-6 py-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchase.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <p className="font-medium">
                      {item.productVariant.product.name} —{" "}
                      {item.productVariant.name}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.productVariant.sku}
                      {item.productVariant.barcode
                        ? ` · ${item.productVariant.barcode}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">{item.quantity}</td>
                  <td className="px-4 py-4">{item.receivedQuantity}</td>
                  <td className="px-4 py-4">{money(item.unitCost)}</td>
                  <td className="px-4 py-4">{money(item.discount)}</td>
                  <td className="px-4 py-4">{money(item.tax)}</td>
                  <td className="px-6 py-4 text-right">
                    {money(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto w-full max-w-sm space-y-2 px-6 py-5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(purchase.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{money(purchase.discount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{money(purchase.tax)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{money(purchase.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      {canReceive && isReceivable && receivableItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Receive stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              Each receipt updates the location balance and creates an immutable
              PURCHASE stock movement.
            </p>
            <ReceivePurchaseForm
              purchaseId={purchase.id}
              items={receivableItems}
            />
          </CardContent>
        </Card>
      ) : null}
      {canCreate &&
      purchase.status !== PurchaseStatus.CANCELLED &&
      parseMoneyToMinor(purchase.balance) > 0n ? (
        <Card>
          <CardHeader>
            <CardTitle>Record supplier payment</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchasePaymentForm
              purchaseId={purchase.id}
              balance={purchase.balance}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          {purchase.payments.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm">
              No payments recorded.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Paid</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchase.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-3">
                      {formatKarachiDateTime(payment.paidAt)}
                    </td>
                    <td className="px-4 py-3">
                      {payment.paymentMethod.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">{money(payment.amount)}</td>
                    <td className="px-4 py-3">{payment.reference ?? "—"}</td>
                    <td className="px-4 py-3">
                      {payment.createdBy.displayName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
