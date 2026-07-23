import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  StockAdjustmentStatus,
  StockMovementType,
  StockReferenceType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createPaginationMeta, parsePagination } from "@/lib/pagination";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const inventoryListSchema = paginationSchema.extend({
  search: z.string().trim().max(180).optional().default(""),
  locationId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  stockStatus: z
    .enum(["all", "in_stock", "out_of_stock", "low_stock"])
    .default("all"),
});

export const movementListSchema = paginationSchema.extend({
  locationId: z.uuid().optional(),
  productVariantId: z.uuid().optional(),
  movementType: z.nativeEnum(StockMovementType).optional(),
  referenceType: z.nativeEnum(StockReferenceType).optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
});

export const adjustmentListSchema = paginationSchema.extend({
  locationId: z.uuid().optional(),
  status: z.nativeEnum(StockAdjustmentStatus).optional(),
});

interface InventoryRow {
  productVariantId: string;
  productName: string;
  variantName: string;
  sku: string;
  categoryName: string;
  quantity: Prisma.Decimal;
  minimumQuantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
  lastMovementAt: Date | null;
  totalCount: bigint;
}

function inventoryStatusFilter(
  stockStatus: z.infer<typeof inventoryListSchema>["stockStatus"],
): Prisma.Sql {
  if (stockStatus === "in_stock") return Prisma.sql`summary.quantity > 0`;
  if (stockStatus === "out_of_stock") return Prisma.sql`summary.quantity = 0`;
  if (stockStatus === "low_stock") {
    return Prisma.sql`summary."trackInventory" = true AND summary.quantity <= summary."minimumQuantity"`;
  }
  return Prisma.sql`TRUE`;
}

export async function getInventoryOptions(
  businessId: string,
  locationIds: readonly string[],
) {
  const [locations, categories, variants] = await Promise.all([
    db.location.findMany({
      where: {
        businessId,
        id: { in: [...locationIds] },
        isActive: true,
        archivedAt: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({
      where: { businessId, isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.productVariant.findMany({
      where: {
        businessId,
        isActive: true,
        archivedAt: null,
        product: { isActive: true, archivedAt: null },
      },
      orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
      take: 1000,
      select: {
        id: true,
        name: true,
        sku: true,
        product: { select: { name: true } },
        barcodes: {
          orderBy: { isPrimary: "desc" },
          take: 1,
          select: { barcode: true },
        },
      },
    }),
  ]);
  return {
    locations,
    categories,
    variants: variants.map((variant) => ({
      id: variant.id,
      label: `${variant.product.name} — ${variant.name}`,
      sku: variant.sku,
      barcode: variant.barcodes[0]?.barcode ?? "",
    })),
  };
}

export async function getAdjustmentProductOptions(
  businessId: string,
  locationId: string,
) {
  const variants = await db.productVariant.findMany({
    where: {
      businessId,
      isActive: true,
      archivedAt: null,
      product: { isActive: true, archivedAt: null },
    },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
    take: 1000,
    select: {
      id: true,
      name: true,
      sku: true,
      product: { select: { name: true } },
      barcodes: {
        orderBy: { isPrimary: "desc" },
        take: 1,
        select: { barcode: true },
      },
      inventoryBalances: {
        where: { businessId, locationId },
        select: { quantity: true },
      },
    },
  });
  return variants.map((variant) => ({
    id: variant.id,
    label: `${variant.product.name} — ${variant.name}`,
    sku: variant.sku,
    barcode: variant.barcodes[0]?.barcode ?? "",
    systemQuantity: variant.inventoryBalances[0]?.quantity.toString() ?? "0",
  }));
}

export async function listInventory(
  businessId: string,
  locationId: string,
  rawQuery: unknown,
) {
  const query = inventoryListSchema.parse(rawQuery);
  const page = parsePagination(query);
  const search = `%${query.search}%`;
  const categoryFilter = query.categoryId
    ? Prisma.sql`p."categoryId" = ${query.categoryId}::uuid`
    : Prisma.sql`TRUE`;
  const rows = await db.$queryRaw<InventoryRow[]>(Prisma.sql`
    WITH summary AS (
      SELECT
        pv.id AS "productVariantId",
        p.name AS "productName",
        pv.name AS "variantName",
        pv.sku,
        c.name AS "categoryName",
        p."trackInventory",
        COALESCE(ib.quantity, 0) AS quantity,
        pv."minimumStock" AS "minimumQuantity",
        COALESCE(ib."averageUnitCost", pv."costPrice", 0) AS "unitCost",
        (COALESCE(ib.quantity, 0) * COALESCE(ib."averageUnitCost", pv."costPrice", 0)) AS "inventoryValue",
        latest."occurredAt" AS "lastMovementAt"
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv."productId"
      INNER JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN inventory_balances ib
        ON ib."businessId" = p."businessId"
        AND ib."locationId" = ${locationId}::uuid
        AND ib."productVariantId" = pv.id
      LEFT JOIN LATERAL (
        SELECT sm."occurredAt"
        FROM stock_movements sm
        WHERE sm."businessId" = p."businessId"
          AND sm."locationId" = ${locationId}::uuid
          AND sm."productVariantId" = pv.id
        ORDER BY sm."occurredAt" DESC
        LIMIT 1
      ) latest ON TRUE
      WHERE p."businessId" = ${businessId}::uuid
        AND p."archivedAt" IS NULL AND p."isActive" = true
        AND pv."archivedAt" IS NULL AND pv."isActive" = true
        AND ${categoryFilter}
        AND (
          ${query.search} = ''
          OR p.name ILIKE ${search}
          OR pv.name ILIKE ${search}
          OR pv.sku ILIKE ${search}
          OR EXISTS (
            SELECT 1 FROM product_barcodes pb
            WHERE pb."productVariantId" = pv.id AND pb.barcode ILIKE ${search}
          )
        )
    )
    SELECT summary.*, COUNT(*) OVER()::bigint AS "totalCount"
    FROM summary
    WHERE ${inventoryStatusFilter(query.stockStatus)}
    ORDER BY summary."productName" ASC, summary."variantName" ASC, summary."productVariantId"
    OFFSET ${page.skip}
    LIMIT ${page.take}
  `);
  const totalItems = Number(rows[0]?.totalCount ?? 0n);
  return {
    items: rows.map((row) => ({
      ...row,
      quantity: row.quantity.toString(),
      minimumQuantity: row.minimumQuantity.toString(),
      unitCost: row.unitCost.toString(),
      inventoryValue: row.inventoryValue.toString(),
    })),
    query,
    pagination: createPaginationMeta({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
}

export async function listStockMovements(
  businessId: string,
  locationIds: readonly string[],
  rawQuery: unknown,
) {
  const query = movementListSchema.parse(rawQuery);
  const page = parsePagination(query);
  const where = {
    businessId,
    locationId: {
      in: query.locationId ? [query.locationId] : [...locationIds],
    },
    ...(query.productVariantId
      ? { productVariantId: query.productVariantId }
      : {}),
    ...(query.movementType ? { movementType: query.movementType } : {}),
    ...(query.referenceType ? { referenceType: query.referenceType } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          occurredAt: {
            ...(query.dateFrom
              ? { gte: new Date(`${query.dateFrom}T00:00:00+05:00`) }
              : {}),
            ...(query.dateTo
              ? { lte: new Date(`${query.dateTo}T23:59:59.999+05:00`) }
              : {}),
          },
        }
      : {}),
  };
  const [records, totalItems] = await Promise.all([
    db.stockMovement.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        movementType: true,
        referenceType: true,
        referenceId: true,
        referenceLineId: true,
        quantityBefore: true,
        quantityChange: true,
        quantityAfter: true,
        unitCost: true,
        notes: true,
        occurredAt: true,
        location: { select: { id: true, name: true } },
        productVariant: {
          select: {
            sku: true,
            name: true,
            product: { select: { name: true } },
          },
        },
        performedBy: { select: { displayName: true } },
      },
    }),
    db.stockMovement.count({ where }),
  ]);
  return {
    items: records.map((movement) => ({
      ...movement,
      quantityBefore: movement.quantityBefore.toString(),
      quantityChange: movement.quantityChange.toString(),
      quantityAfter: movement.quantityAfter.toString(),
      unitCost: movement.unitCost?.toString() ?? null,
    })),
    query,
    pagination: createPaginationMeta({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
}

export async function getInventoryValuation(
  businessId: string,
  locationId: string,
) {
  const rows = await db.$queryRaw<
    Array<{
      categoryName: string;
      quantity: Prisma.Decimal;
      value: Prisma.Decimal;
    }>
  >(Prisma.sql`
    SELECT
      c.name AS "categoryName",
      COALESCE(SUM(ib.quantity), 0) AS quantity,
      COALESCE(SUM(ib.quantity * ib."averageUnitCost"), 0) AS value
    FROM inventory_balances ib
    INNER JOIN product_variants pv ON pv.id = ib."productVariantId"
    INNER JOIN products p ON p.id = pv."productId"
    INNER JOIN categories c ON c.id = p."categoryId"
    WHERE ib."businessId" = ${businessId}::uuid
      AND ib."locationId" = ${locationId}::uuid
      AND p."archivedAt" IS NULL AND pv."archivedAt" IS NULL
    GROUP BY c.id, c.name
    ORDER BY c.name ASC
  `);
  const total = rows.reduce(
    (sum, row) => sum.add(row.value),
    new Prisma.Decimal(0),
  );
  return {
    categories: rows.map((row) => ({
      categoryName: row.categoryName,
      quantity: row.quantity.toString(),
      value: row.value.toString(),
    })),
    totalValue: total.toString(),
  };
}

export async function listStockAdjustments(
  businessId: string,
  locationIds: readonly string[],
  rawQuery: unknown,
) {
  const query = adjustmentListSchema.parse(rawQuery);
  const page = parsePagination(query);
  const where = {
    businessId,
    locationId: {
      in: query.locationId ? [query.locationId] : [...locationIds],
    },
    ...(query.status ? { status: query.status } : {}),
  };
  const [records, totalItems] = await Promise.all([
    db.stockAdjustment.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true,
        adjustmentNumber: true,
        adjustmentType: true,
        status: true,
        reason: true,
        createdAt: true,
        completedAt: true,
        location: { select: { id: true, name: true } },
        createdBy: { select: { displayName: true } },
        _count: { select: { items: true } },
      },
    }),
    db.stockAdjustment.count({ where }),
  ]);
  return {
    items: records.map((record) => ({
      ...record,
      itemCount: record._count.items,
    })),
    query,
    pagination: createPaginationMeta({
      page: page.page,
      pageSize: page.pageSize,
      totalItems,
    }),
  };
}

export async function getStockAdjustmentDetails(
  businessId: string,
  locationIds: readonly string[],
  adjustmentId: string,
) {
  const adjustment = await db.stockAdjustment.findFirst({
    where: {
      id: adjustmentId,
      businessId,
      locationId: { in: [...locationIds] },
    },
    select: {
      id: true,
      adjustmentNumber: true,
      adjustmentType: true,
      status: true,
      reason: true,
      notes: true,
      createdAt: true,
      completedAt: true,
      location: { select: { id: true, name: true } },
      createdBy: { select: { displayName: true } },
      completedBy: { select: { displayName: true } },
      items: {
        select: {
          id: true,
          systemQuantity: true,
          countedQuantity: true,
          quantityChange: true,
          unitCost: true,
          productVariant: {
            select: {
              sku: true,
              name: true,
              product: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (adjustment === null) return null;
  return {
    ...adjustment,
    items: adjustment.items.map((item) => ({
      ...item,
      systemQuantity: item.systemQuantity.toString(),
      countedQuantity: item.countedQuantity.toString(),
      quantityChange: item.quantityChange.toString(),
      unitCost: item.unitCost?.toString() ?? null,
    })),
  };
}
