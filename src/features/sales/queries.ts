import { db } from "@/lib/db";

export async function listSales(
  businessId: string,
  locationIds: readonly string[],
) {
  return db.sale.findMany({
    where: {
      businessId,
      locationId: { in: [...locationIds] },
      status: { not: "HELD" },
    },
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      total: true,
      refundedAmount: true,
      completedAt: true,
      cashier: { select: { displayName: true } },
      customer: { select: { name: true } },
      payments: { select: { paymentMethod: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
export async function getSaleDetails(
  businessId: string,
  locationIds: readonly string[],
  saleId: string,
) {
  return db.sale.findFirst({
    where: { id: saleId, businessId, locationId: { in: [...locationIds] } },
    include: {
      business: true,
      location: true,
      register: true,
      cashier: { select: { displayName: true } },
      customer: true,
      items: true,
      payments: true,
      returns: {
        include: { items: true, refunds: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getPosData(
  businessId: string,
  locationId: string | null,
) {
  const [categories, variants, customers, heldSales, registerSession] =
    await Promise.all([
      db.category.findMany({
        where: { businessId, isActive: true, archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.productVariant.findMany({
        where: {
          businessId,
          isActive: true,
          archivedAt: null,
          product: { isActive: true, archivedAt: null },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              taxRate: true,
              taxable: true,
            },
          },
          barcodes: { select: { barcode: true }, take: 3 },
          prices: {
            where: {
              isActive: true,
              priceType: "RETAIL",
              OR: [{ locationId }, { locationId: null }],
            },
            select: { amount: true, locationId: true },
            orderBy: { locationId: "desc" },
          },
        },
        orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
        take: 1000,
      }),
      db.customer.findMany({
        where: { businessId, isActive: true, archivedAt: null },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: 200,
      }),
      db.sale.findMany({
        where: {
          businessId,
          ...(locationId ? { locationId } : {}),
          status: "HELD",
        },
        select: {
          id: true,
          receiptNumber: true,
          createdAt: true,
          cashier: { select: { displayName: true } },
          items: {
            select: {
              productVariantId: true,
              quantity: true,
              unitPrice: true,
              originalUnitPrice: true,
              discount: true,
              priceOverrideReason: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      locationId
        ? db.registerSession.findFirst({
            where: { businessId, locationId, status: "OPEN" },
            select: { id: true, register: { select: { name: true } } },
            orderBy: { openedAt: "desc" },
          })
        : null,
    ]);
  return {
    categories,
    customers,
    heldSales,
    registerSession,
    products: variants.map((variant) => ({
      id: variant.id,
      name: `${variant.product.name} — ${variant.name}`,
      sku: variant.sku,
      categoryId: variant.product.categoryId,
      sellingPrice: (
        variant.prices.find((price) => price.locationId === locationId)
          ?.amount ??
        variant.prices.find((price) => price.locationId === null)?.amount ??
        variant.sellingPrice
      ).toString(),
      barcodes: variant.barcodes.map((barcode) => barcode.barcode),
    })),
  };
}
