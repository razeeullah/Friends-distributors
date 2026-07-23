import { notFound } from "next/navigation";
import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { getSaleDetails } from "@/features/sales/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";

export default async function SaleDetailsPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const context = await requirePermission("sale.view");
  const { saleId } = await params;
  const sale = await getSaleDetails(
    context.business.id,
    context.locations.map((location) => location.id),
    saleId,
  );
  if (!sale) notFound();
  const showProfit = context.permissions.has("report.profit");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle
        title={`Receipt ${sale.receiptNumber}`}
        description={`${sale.business.name} · ${sale.cashier.displayName}`}
      />
      <section className="rounded-lg border p-5">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            Status: <b>{sale.status}</b>
          </p>
          <p>
            Customer: <b>{sale.customer?.name ?? "Walk-in"}</b>
          </p>
          <p>
            Location: <b>{sale.location.name}</b>
          </p>
          <p>
            Register: <b>{sale.register?.name ?? "—"}</b>
          </p>
        </div>
        <table className="mt-5 w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  {item.productNameSnapshot} — {item.variantNameSnapshot}
                </td>
                <td>{item.quantity.toString()}</td>
                <td>
                  {formatMoney(parseMoneyToMinor(item.lineTotal.toString()))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-right text-sm">
          <p>
            Discount:{" "}
            {formatMoney(
              parseMoneyToMinor(
                sale.itemDiscount.add(sale.cartDiscount).toString(),
              ),
            )}
          </p>
          <p>Tax: {formatMoney(parseMoneyToMinor(sale.tax.toString()))}</p>
          <p className="text-lg font-bold">
            Total: {formatMoney(parseMoneyToMinor(sale.total.toString()))}
          </p>
          <p>Paid: {formatMoney(parseMoneyToMinor(sale.paid.toString()))}</p>
          {showProfit ? (
            <p>
              Gross profit:{" "}
              {formatMoney(parseMoneyToMinor(sale.grossProfit.toString()))}
            </p>
          ) : null}
        </div>
        <p className="mt-4 text-sm">
          Payments:{" "}
          {sale.payments
            .map((payment) => `${payment.paymentMethod} ${payment.amount}`)
            .join(", ")}
        </p>
      </section>
      <section className="rounded-lg border p-5">
        <h2 className="font-semibold">Returns</h2>
        {sale.returns.length ? (
          sale.returns.map((item) => (
            <p key={item.id} className="mt-2 text-sm">
              {item.returnNumber} · {item.status} ·{" "}
              {formatMoney(parseMoneyToMinor(item.refundAmount.toString()))}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No returns recorded.
          </p>
        )}
      </section>
    </div>
  );
}
