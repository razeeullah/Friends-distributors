import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
export async function getExpenseData(
  businessId: string,
  locationIds: readonly string[],
) {
  const [categories, expenses] = await Promise.all([
    db.expenseCategory.findMany({
      where: { businessId, isActive: true, archivedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.expense.findMany({
      where: {
        businessId,
        locationId: { in: [...locationIds] },
        archivedAt: null,
      },
      include: {
        expenseCategory: true,
        location: true,
        createdBy: { select: { displayName: true } },
      },
      orderBy: { expenseDate: "desc" },
      take: 100,
    }),
  ]);
  return { categories, expenses };
}
export async function profitSummary(businessId: string) {
  const [sales, expenses] = await Promise.all([
    db.sale.aggregate({
      where: { businessId, status: { in: ["COMPLETED", "REFUNDED"] } },
      _sum: {
        total: true,
        tax: true,
        refundedAmount: true,
        costOfGoodsSold: true,
        cogsReversed: true,
      },
    }),
    db.expense.aggregate({
      where: {
        businessId,
        status: { in: ["APPROVED", "PAID"] },
        archivedAt: null,
      },
      _sum: { total: true },
    }),
  ]);
  const grossSales = sales._sum.total ?? new Prisma.Decimal(0);
  const tax = sales._sum.tax ?? new Prisma.Decimal(0);
  const refunds = sales._sum.refundedAmount ?? new Prisma.Decimal(0);
  const cogs = (sales._sum.costOfGoodsSold ?? new Prisma.Decimal(0)).sub(
    sales._sum.cogsReversed ?? new Prisma.Decimal(0),
  );
  const grossProfit = grossSales.sub(tax).sub(refunds).sub(cogs);
  const operatingExpenses = expenses._sum?.total ?? new Prisma.Decimal(0);
  return {
    grossSales,
    tax,
    refunds,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit: grossProfit.sub(operatingExpenses),
  };
}
