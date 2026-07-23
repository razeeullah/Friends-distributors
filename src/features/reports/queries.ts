import { Prisma } from "@/generated/prisma/client";
import { SaleStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export async function getDashboardMetrics(
  businessId: string,
  locationIds: readonly string[],
  includeProfit: boolean,
) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
  }).format(new Date());
  const where = {
    businessId,
    locationId: { in: [...locationIds] },
    status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] },
    completedAt: {
      gte: new Date(`${day}T00:00:00+05:00`),
      lte: new Date(`${day}T23:59:59.999+05:00`),
    },
  };
  const [sales, registers, inventory] = await Promise.all([
    db.sale.aggregate({
      where,
      _sum: {
        total: true,
        tax: true,
        refundedAmount: true,
        costOfGoodsSold: true,
        cogsReversed: true,
      },
      _count: { id: true },
    }),
    db.registerSession.count({
      where: {
        businessId,
        locationId: { in: [...locationIds] },
        status: "OPEN",
      },
    }),
    db.$queryRaw<{ value: Prisma.Decimal }[]>(
      Prisma.sql`SELECT COALESCE(SUM(quantity * "averageUnitCost"),0) AS value FROM inventory_balances WHERE "businessId"=${businessId}::uuid AND "locationId" IN (${Prisma.join(locationIds.map((id) => Prisma.sql`${id}::uuid`))})`,
    ),
  ]);
  const sums = sales._sum!;
  const count = sales._count as { id: number };
  const total = sums.total ?? new Prisma.Decimal(0);
  const cogs = includeProfit
    ? (sums.costOfGoodsSold ?? new Prisma.Decimal(0)).sub(
        sums.cogsReversed ?? new Prisma.Decimal(0),
      )
    : null;
  const grossProfit = cogs
    ? total
        .sub(sums.tax ?? 0)
        .sub(sums.refundedAmount ?? 0)
        .sub(cogs)
    : null;
  const expenses = includeProfit
    ? await db.expense.aggregate({
        where: {
          businessId,
          locationId: { in: [...locationIds] },
          status: { in: ["APPROVED", "PAID"] },
        },
        _sum: { total: true },
      })
    : null;
  return {
    sales: total,
    transactions: count.id,
    averageOrder: count.id ? total.div(count.id) : new Prisma.Decimal(0),
    inventoryValue: inventory[0]?.value ?? new Prisma.Decimal(0),
    openRegisters: registers,
    grossProfit,
    netProfit: grossProfit?.sub(expenses?._sum.total ?? 0) ?? null,
  };
}
