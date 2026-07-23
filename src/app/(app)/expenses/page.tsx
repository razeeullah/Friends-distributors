import { PageTitle } from "@/components/layout/page-title";
import { requirePermission } from "@/features/auth/session";
import { getExpenseData, profitSummary } from "@/features/expenses/queries";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
export default async function ExpensesPage() {
  const context = await requirePermission("expense.view");
  const data = await getExpenseData(
    context.business.id,
    context.locations.map((location) => location.id),
  );
  const profit = context.permissions.has("report.profit")
    ? await profitSummary(context.business.id)
    : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle
        title="Expenses"
        description="Operating expenses and approval workflow."
      />
      {profit ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border p-4">
            Gross profit
            <br />
            <b>
              {formatMoney(parseMoneyToMinor(profit.grossProfit.toString()))}
            </b>
          </div>
          <div className="rounded border p-4">
            Operating expenses
            <br />
            <b>
              {formatMoney(
                parseMoneyToMinor(profit.operatingExpenses.toString()),
              )}
            </b>
          </div>
          <div className="rounded border p-4">
            Net profit
            <br />
            <b>{formatMoney(parseMoneyToMinor(profit.netProfit.toString()))}</b>
          </div>
        </div>
      ) : null}
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Number</th>
              <th>Category</th>
              <th>Payee</th>
              <th>Status</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((expense) => (
              <tr key={expense.id} className="border-t">
                <td className="p-3">{expense.expenseNumber}</td>
                <td>{expense.expenseCategory.name}</td>
                <td>{expense.vendorName ?? "—"}</td>
                <td>{expense.status}</td>
                <td className="p-3 text-right">
                  {formatMoney(parseMoneyToMinor(expense.total.toString()))}
                </td>
              </tr>
            ))}
            {data.expenses.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-muted-foreground p-8 text-center"
                >
                  No expenses recorded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
