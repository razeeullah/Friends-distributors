import Link from "next/link";
import { notFound } from "next/navigation";

import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/features/auth/session";
import { getSupplierDetails } from "@/features/purchases/queries";
import { formatKarachiDate } from "@/lib/dates";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

const money = (value: string) => formatMoney(parseMoneyToMinor(value));

export default async function SupplierDetailsPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const context = await requirePermission("supplier.manage");
  const { supplierId } = await params;
  const supplier = await getSupplierDetails(context.business.id, supplierId);
  if (!supplier) notFound();
  const payments = supplier.purchases.flatMap((purchase) =>
    purchase.payments.map((payment) => ({
      ...payment,
      purchaseNumber: purchase.purchaseNumber,
    })),
  );
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle
        title={supplier.name}
        description={`Supplier ${supplier.code}`}
        actions={
          <Button asChild>
            <Link href={`/suppliers/${supplier.id}/edit`}>Edit supplier</Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Current payable</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(supplier.payableBalance)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Opening balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {money(supplier.openingBalance)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={supplier.isActive ? "default" : "secondary"}>
              {supplier.isActive ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Contact:</span>{" "}
            {supplier.contactName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span>{" "}
            {supplier.phone ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {supplier.email ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Tax / registration:</span>{" "}
            {supplier.taxRegistrationNumber ?? "—"}
          </p>
          <p className="md:col-span-2">
            <span className="text-muted-foreground">Address:</span>{" "}
            {supplier.address ?? "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          {supplier.purchases.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm">
              No purchases recorded.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Purchase</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplier.purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-3">
                      <Link
                        className="font-medium hover:underline"
                        href={`/purchases/${purchase.id}`}
                      >
                        {purchase.purchaseNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {formatKarachiDate(purchase.purchaseDate)}
                    </td>
                    <td className="px-4 py-3">
                      {purchase.status.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">{money(purchase.total)}</td>
                    <td className="px-4 py-3">{money(purchase.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          {payments.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm">
              No payments recorded.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b">
                <tr>
                  <th className="px-6 py-3">Purchase</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-3">{payment.purchaseNumber}</td>
                    <td className="px-4 py-3">
                      {formatKarachiDate(payment.paidAt)}
                    </td>
                    <td className="px-4 py-3">
                      {payment.paymentMethod.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">{money(payment.amount)}</td>
                    <td className="px-4 py-3">{payment.reference ?? "—"}</td>
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
