import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createPaginationMeta, parsePagination } from "@/lib/pagination";

export const productListQuerySchema = z.object({
  search: z.string().trim().max(180).optional().default(""),
  categoryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  status: z.enum(["all", "active", "inactive", "archived"]).default("active"),
  lowStock: z.enum(["true", "false"]).default("false"),
  sort: z
    .enum([
      "name_asc",
      "name_desc",
      "price_asc",
      "price_desc",
      "stock_asc",
      "stock_desc",
      "created_asc",
      "created_desc",
    ])
    .default("name_asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

interface ProductListRow {
  id: string;
  name: string;
  sku: string;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  categoryName: string;
  brandName: string | null;
  unitAbbreviation: string;
  variantCount: bigint;
  sellingPrice: Prisma.Decimal | null;
  currentStock: Prisma.Decimal;
  lowStock: boolean;
  totalCount: bigint;
}

function productOrder(
  sort: z.infer<typeof productListQuerySchema>["sort"],
): Prisma.Sql {
  switch (sort) {
    case "name_desc":
      return Prisma.sql`summary.name DESC, summary.id`;
    case "price_asc":
      return Prisma.sql`summary."sellingPrice" ASC NULLS LAST, summary.name`;
    case "price_desc":
      return Prisma.sql`summary."sellingPrice" DESC NULLS LAST, summary.name`;
    case "stock_asc":
      return Prisma.sql`summary."currentStock" ASC, summary.name`;
    case "stock_desc":
      return Prisma.sql`summary."currentStock" DESC, summary.name`;
    case "created_asc":
      return Prisma.sql`summary."createdAt" ASC, summary.name`;
    case "created_desc":
      return Prisma.sql`summary."createdAt" DESC, summary.name`;
    default:
      return Prisma.sql`summary.name ASC, summary.id`;
  }
}

export async function listProducts(
  businessId: string,
  locationId: string,
  rawQuery: unknown,
) {
  const query = productListQuerySchema.parse(rawQuery);
  const pagination = parsePagination(query);
  const search = `%${query.search}%`;
  const statusFilter =
    query.status === "archived"
      ? Prisma.sql`p."archivedAt" IS NOT NULL`
      : query.status === "inactive"
        ? Prisma.sql`p."archivedAt" IS NULL AND p."isActive" = false`
        : query.status === "all"
          ? Prisma.sql`TRUE`
          : Prisma.sql`p."archivedAt" IS NULL AND p."isActive" = true`;
  const categoryFilter = query.categoryId
    ? Prisma.sql`p."categoryId" = ${query.categoryId}::uuid`
    : Prisma.sql`TRUE`;
  const brandFilter = query.brandId
    ? Prisma.sql`p."brandId" = ${query.brandId}::uuid`
    : Prisma.sql`TRUE`;
  const lowStockFilter =
    query.lowStock === "true"
      ? Prisma.sql`summary."lowStock" = true`
      : Prisma.sql`TRUE`;

  const rows = await db.$queryRaw<ProductListRow[]>(Prisma.sql`
    WITH summary AS (
      SELECT
        p.id,
        p.name,
        p.sku,
        p."isActive",
        p."archivedAt",
        p."createdAt",
        c.name AS "categoryName",
        b.name AS "brandName",
        u.abbreviation AS "unitAbbreviation",
        COUNT(DISTINCT pv.id)::bigint AS "variantCount",
        MIN(pv."sellingPrice") AS "sellingPrice",
        COALESCE(SUM(ib.quantity), 0) AS "currentStock",
        COALESCE(
          BOOL_OR(p."trackInventory" AND COALESCE(ib.quantity, 0) <= pv."minimumStock"),
          false
        ) AS "lowStock"
      FROM products p
      INNER JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN brands b ON b.id = p."brandId"
      INNER JOIN units u ON u.id = p."unitId"
      LEFT JOIN product_variants pv
        ON pv."productId" = p.id AND pv."archivedAt" IS NULL
      LEFT JOIN inventory_balances ib
        ON ib."productVariantId" = pv.id
        AND ib."businessId" = p."businessId"
        AND ib."locationId" = ${locationId}::uuid
      WHERE p."businessId" = ${businessId}::uuid
        AND ${statusFilter}
        AND ${categoryFilter}
        AND ${brandFilter}
        AND (
          ${query.search} = ''
          OR p.name ILIKE ${search}
          OR p.sku ILIKE ${search}
          OR EXISTS (
            SELECT 1 FROM product_variants search_variant
            WHERE search_variant."productId" = p.id
              AND search_variant.sku ILIKE ${search}
          )
          OR EXISTS (
            SELECT 1
            FROM product_barcodes search_barcode
            INNER JOIN product_variants barcode_variant
              ON barcode_variant.id = search_barcode."productVariantId"
            WHERE barcode_variant."productId" = p.id
              AND search_barcode.barcode ILIKE ${search}
          )
        )
      GROUP BY p.id, c.name, b.name, u.abbreviation
    )
    SELECT summary.*, COUNT(*) OVER()::bigint AS "totalCount"
    FROM summary
    WHERE ${lowStockFilter}
    ORDER BY ${productOrder(query.sort)}
    OFFSET ${pagination.skip}
    LIMIT ${pagination.take}
  `);
  const totalItems = Number(rows[0]?.totalCount ?? 0n);
  return {
    items: rows.map((row) => ({
      ...row,
      variantCount: Number(row.variantCount),
      sellingPrice: row.sellingPrice?.toString() ?? "0.00",
      currentStock: row.currentStock.toString(),
    })),
    query,
    pagination: createPaginationMeta({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
    }),
  };
}

export async function getCatalogOptions(businessId: string) {
  const [categories, brands, units] = await Promise.all([
    db.category.findMany({
      where: { businessId, archivedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.brand.findMany({
      where: { businessId, archivedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.unit.findMany({
      where: { businessId, archivedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, abbreviation: true, precision: true },
    }),
  ]);
  return { categories, brands, units };
}

export async function getProductDetails(
  businessId: string,
  productId: string,
  locationId: string,
) {
  const product = await db.product.findFirst({
    where: { id: productId, businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sku: true,
      taxable: true,
      taxRate: true,
      taxInclusive: true,
      trackInventory: true,
      allowNegativeStock: true,
      minimumStock: true,
      isActive: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true, abbreviation: true } },
      variants: {
        orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          sku: true,
          size: true,
          color: true,
          costPrice: true,
          sellingPrice: true,
          minimumStock: true,
          isActive: true,
          archivedAt: true,
          barcodes: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { id: true, barcode: true, isPrimary: true },
          },
          inventoryBalances: {
            where: { locationId },
            select: { quantity: true, averageUnitCost: true },
          },
        },
      },
    },
  });
  if (product === null) return null;
  return {
    ...product,
    taxRate: product.taxRate.toString(),
    minimumStock: product.minimumStock.toString(),
    variants: product.variants.map((variant) => ({
      ...variant,
      costPrice: variant.costPrice.toString(),
      sellingPrice: variant.sellingPrice.toString(),
      minimumStock: variant.minimumStock.toString(),
      currentStock: variant.inventoryBalances[0]?.quantity.toString() ?? "0",
      averageUnitCost:
        variant.inventoryBalances[0]?.averageUnitCost.toString() ?? "0.00",
    })),
  };
}

export async function getProductActivity(
  businessId: string,
  productId: string,
) {
  return db.auditLog.findMany({
    where: { businessId, entityType: "Product", entityId: productId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      before: true,
      after: true,
      metadata: true,
      createdAt: true,
      actor: { select: { displayName: true, username: true } },
    },
  });
}

export async function listCategories(businessId: string) {
  return db.category.findMany({
    where: { businessId, archivedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
}

export async function listBrands(businessId: string) {
  return db.brand.findMany({
    where: { businessId, archivedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
}

export async function listUnits(businessId: string) {
  return db.unit.findMany({
    where: { businessId, archivedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      abbreviation: true,
      precision: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });
}
