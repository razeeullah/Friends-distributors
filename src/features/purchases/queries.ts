import { z } from "zod";

import { PurchaseStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createPaginationMeta, parsePagination } from "@/lib/pagination";

const listBase = z.object({
  search: z.string().trim().max(180).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const supplierListSchema = listBase.extend({
  status: z.enum(["all", "active", "inactive"]).default("active"),
});

export const purchaseListSchema = listBase.extend({
  status: z.nativeEnum(PurchaseStatus).optional(),
  supplierId: z.uuid().optional(),
  locationId: z.uuid().optional(),
});

export async function listSuppliers(businessId: string, rawQuery: unknown) {
  const query = supplierListSchema.parse(rawQuery);
  const page = parsePagination(query);
  const where = {
    businessId,
    archivedAt: null,
    ...(query.status === "active"
      ? { isActive: true }
      : query.status === "inactive"
        ? { isActive: false }
        : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" as const } },
            { code: { contains: query.search, mode: "insensitive" as const } },
            { email: { contains: query.search, mode: "insensitive" as const } },
            { phone: { contains: query.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [records, totalItems] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        code: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        isActive: true,
        openingBalance: true,
        purchases: {
          where: { status: { not: PurchaseStatus.CANCELLED } },
          select: { balance: true },
        },
      },
    }),
    db.supplier.count({ where }),
  ]);
  return {
    items: records.map(({ purchases, openingBalance, ...supplier }) => ({
      ...supplier,
      openingBalance: openingBalance.toString(),
      payableBalance: purchases
        .reduce((sum, purchase) => sum.add(purchase.balance), openingBalance)
        .toString(),
    })),
    query,
    pagination: createPaginationMeta({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
}

export async function getSupplierDetails(
  businessId: string,
  supplierId: string,
) {
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, businessId, archivedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      taxRegistrationNumber: true,
      paymentTermsDays: true,
      openingBalance: true,
      isActive: true,
      createdAt: true,
      purchases: {
        orderBy: { purchaseDate: "desc" },
        take: 50,
        select: {
          id: true,
          purchaseNumber: true,
          status: true,
          purchaseDate: true,
          total: true,
          paidAmount: true,
          balance: true,
          location: { select: { name: true } },
          payments: {
            orderBy: { paidAt: "desc" },
            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              reference: true,
              paidAt: true,
            },
          },
        },
      },
    },
  });
  if (supplier === null) return null;
  const activePurchases = supplier.purchases.filter(
    ({ status }) => status !== PurchaseStatus.CANCELLED,
  );
  return {
    ...supplier,
    openingBalance: supplier.openingBalance.toString(),
    payableBalance: activePurchases
      .reduce(
        (sum, purchase) => sum.add(purchase.balance),
        supplier.openingBalance,
      )
      .toString(),
    purchases: supplier.purchases.map(({ payments, ...purchase }) => ({
      ...purchase,
      total: purchase.total.toString(),
      paidAmount: purchase.paidAmount.toString(),
      balance: purchase.balance.toString(),
      payments: payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toString(),
      })),
    })),
  };
}

export async function listPurchases(
  businessId: string,
  accessibleLocationIds: readonly string[],
  rawQuery: unknown,
) {
  const query = purchaseListSchema.parse(rawQuery);
  const page = parsePagination(query);
  const where = {
    businessId,
    locationId: {
      in: query.locationId ? [query.locationId] : [...accessibleLocationIds],
    },
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.search
      ? {
          OR: [
            {
              purchaseNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              supplierInvoiceNumber: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            {
              supplier: {
                name: { contains: query.search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const [records, totalItems] = await Promise.all([
    db.purchase.findMany({
      where,
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        purchaseNumber: true,
        supplierInvoiceNumber: true,
        status: true,
        purchaseDate: true,
        total: true,
        paidAmount: true,
        balance: true,
        supplier: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.purchase.count({ where }),
  ]);
  return {
    items: records.map((purchase) => ({
      ...purchase,
      total: purchase.total.toString(),
      paidAmount: purchase.paidAmount.toString(),
      balance: purchase.balance.toString(),
      itemCount: purchase._count.items,
    })),
    query,
    pagination: createPaginationMeta({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
}

export async function getPurchaseOptions(
  businessId: string,
  locationIds: readonly string[],
) {
  const [suppliers, locations, variants] = await Promise.all([
    db.supplier.findMany({
      where: { businessId, archivedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.location.findMany({
      where: {
        id: { in: [...locationIds] },
        businessId,
        archivedAt: null,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.productVariant.findMany({
      where: {
        businessId,
        archivedAt: null,
        isActive: true,
        product: { archivedAt: null, isActive: true },
      },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
      take: 1000,
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        product: { select: { name: true } },
        barcodes: {
          orderBy: { isPrimary: "desc" },
          select: { barcode: true },
        },
      },
    }),
  ]);
  return {
    suppliers,
    locations,
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: variant.barcodes[0]?.barcode ?? "",
      label: `${variant.product.name} — ${variant.name}`,
      unitCost: variant.costPrice.toString(),
    })),
  };
}

export async function getPurchaseDetails(
  businessId: string,
  accessibleLocationIds: readonly string[],
  purchaseId: string,
) {
  const purchase = await db.purchase.findFirst({
    where: {
      id: purchaseId,
      businessId,
      locationId: { in: [...accessibleLocationIds] },
    },
    select: {
      id: true,
      purchaseNumber: true,
      supplierInvoiceNumber: true,
      status: true,
      purchaseDate: true,
      orderedAt: true,
      receivedAt: true,
      notes: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true,
      paidAmount: true,
      balance: true,
      supplier: { select: { id: true, code: true, name: true } },
      location: { select: { id: true, name: true } },
      createdBy: { select: { displayName: true } },
      receivedBy: { select: { displayName: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          receivedQuantity: true,
          unitCost: true,
          discount: true,
          tax: true,
          lineSubtotal: true,
          lineTotal: true,
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
              product: { select: { name: true } },
              barcodes: {
                take: 1,
                select: { barcode: true },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          paymentMethod: true,
          amount: true,
          reference: true,
          paidAt: true,
          createdBy: { select: { displayName: true } },
        },
      },
    },
  });
  if (purchase === null) return null;
  return {
    ...purchase,
    subtotal: purchase.subtotal.toString(),
    discount: purchase.discount.toString(),
    tax: purchase.tax.toString(),
    total: purchase.total.toString(),
    paidAmount: purchase.paidAmount.toString(),
    balance: purchase.balance.toString(),
    items: purchase.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      receivedQuantity: item.receivedQuantity.toString(),
      unitCost: item.unitCost.toString(),
      discount: item.discount.toString(),
      tax: item.tax.toString(),
      lineSubtotal: item.lineSubtotal.toString(),
      lineTotal: item.lineTotal.toString(),
      productVariant: {
        ...item.productVariant,
        barcode: item.productVariant.barcodes[0]?.barcode ?? "",
      },
    })),
    payments: purchase.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
    })),
  };
}
