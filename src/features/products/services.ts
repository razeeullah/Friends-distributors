import { randomBytes } from "node:crypto";

import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { AuthContext } from "@/features/auth/session";
import {
  assertCatalogPermission,
  assertNoDuplicateVariants,
  assertProductCanBeArchived,
  CatalogPolicyError,
} from "@/features/products/policy";
import type {
  BrandInput,
  CategoryInput,
  CreateProductInput,
  ProductVariantInput,
  UnitInput,
  UpdateProductInput,
} from "@/features/products/schemas";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  ProductPriceType,
  SaleStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 175);
}

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function effectiveVariants(
  product: Pick<
    CreateProductInput,
    "name" | "sku" | "minimumStock" | "variants"
  >,
): readonly ProductVariantInput[] {
  const variants =
    product.variants.length > 0
      ? product.variants
      : [
          {
            name: "Default",
            sku: product.sku,
            barcode: "",
            size: "",
            color: "",
            costPrice: "0.00",
            sellingPrice: "0.00",
            minimumStock: product.minimumStock,
            isActive: true,
          },
        ];
  assertNoDuplicateVariants(variants);
  return variants;
}

async function lockCatalog(
  transaction: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  await transaction.$queryRaw<readonly { locked: number }[]>`
    SELECT 1 AS locked
    FROM pg_advisory_xact_lock(hashtext(${`catalog-identifiers:${businessId}`}))
  `;
}

async function uniqueSlug(
  transaction: Prisma.TransactionClient,
  businessId: string,
  name: string,
  productId?: string,
): Promise<string> {
  const base = slugify(name) || "product";
  const existing = await transaction.product.findFirst({
    where: {
      businessId,
      slug: base,
      ...(productId === undefined ? {} : { id: { not: productId } }),
    },
    select: { id: true },
  });
  return existing === null
    ? base
    : `${base.slice(0, 185)}-${randomBytes(4).toString("hex")}`;
}

async function assertReferences(
  transaction: Prisma.TransactionClient,
  businessId: string,
  input: Pick<CreateProductInput, "categoryId" | "brandId" | "unitId">,
): Promise<void> {
  const [category, unit, brand] = await Promise.all([
    transaction.category.findFirst({
      where: {
        id: input.categoryId,
        businessId,
        archivedAt: null,
        isActive: true,
      },
      select: { id: true },
    }),
    transaction.unit.findFirst({
      where: { id: input.unitId, businessId, archivedAt: null, isActive: true },
      select: { id: true },
    }),
    input.brandId
      ? transaction.brand.findFirst({
          where: {
            id: input.brandId,
            businessId,
            archivedAt: null,
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (category === null || unit === null || (input.brandId && brand === null)) {
    throw new CatalogPolicyError(
      "NOT_FOUND",
      "The selected category, brand, or unit is unavailable.",
    );
  }
}

async function assertUniqueIdentifiers(
  transaction: Prisma.TransactionClient,
  businessId: string,
  productId: string | undefined,
  productSku: string,
  variants: readonly ProductVariantInput[],
): Promise<void> {
  const variantIds = variants.flatMap(({ id }) => (id ? [id] : []));
  const skuValues = [
    ...new Set([productSku, ...variants.map(({ sku }) => sku)]),
  ];
  const barcodeValues = variants.flatMap(({ barcode }) =>
    barcode ? [barcode] : [],
  );
  const [productConflict, variantConflict, barcodeConflict] = await Promise.all(
    [
      transaction.product.findFirst({
        where: {
          businessId,
          sku: { in: skuValues },
          ...(productId === undefined ? {} : { id: { not: productId } }),
        },
        select: { id: true },
      }),
      transaction.productVariant.findFirst({
        where: {
          businessId,
          sku: { in: skuValues },
          ...(variantIds.length === 0 ? {} : { id: { notIn: variantIds } }),
          ...(productId === undefined ? {} : { productId: { not: productId } }),
        },
        select: { id: true },
      }),
      barcodeValues.length === 0
        ? Promise.resolve(null)
        : transaction.productBarcode.findFirst({
            where: {
              businessId,
              barcode: { in: barcodeValues },
              ...(variantIds.length === 0
                ? {}
                : { productVariantId: { notIn: variantIds } }),
            },
            select: { id: true },
          }),
    ],
  );
  if (productConflict !== null || variantConflict !== null) {
    throw new CatalogPolicyError(
      "SKU_CONFLICT",
      "A product or variant already uses one of the submitted SKUs.",
    );
  }
  if (barcodeConflict !== null) {
    throw new CatalogPolicyError(
      "BARCODE_CONFLICT",
      "A product variant already uses one of the submitted barcodes.",
    );
  }
}

async function createVariant(
  transaction: Prisma.TransactionClient,
  businessId: string,
  productId: string,
  input: ProductVariantInput,
): Promise<string> {
  const variant = await transaction.productVariant.create({
    data: {
      businessId,
      productId,
      name: input.name,
      sku: input.sku,
      size: nullable(input.size),
      color: nullable(input.color),
      costPrice: decimal(input.costPrice),
      sellingPrice: decimal(input.sellingPrice),
      minimumStock: decimal(input.minimumStock),
      isActive: input.isActive,
      ...(input.barcode
        ? {
            barcodes: {
              create: {
                businessId,
                barcode: input.barcode,
                isPrimary: true,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
  await transaction.productPrice.create({
    data: {
      businessId,
      productVariantId: variant.id,
      priceType: ProductPriceType.RETAIL,
      amount: decimal(input.sellingPrice),
      isActive: input.isActive,
    },
  });
  return variant.id;
}

function auditProductInput(
  input: CreateProductInput | UpdateProductInput,
  variants: readonly ProductVariantInput[],
) {
  return {
    name: input.name,
    sku: input.sku,
    categoryId: input.categoryId,
    brandId: input.brandId || null,
    unitId: input.unitId,
    taxable: input.taxable,
    taxRate: input.taxable ? input.taxRate : "0",
    trackInventory: input.trackInventory,
    allowNegativeStock: input.allowNegativeStock,
    minimumStock: input.minimumStock,
    isActive: input.isActive,
    variants: variants.map((variant) => ({
      id: variant.id ?? null,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode || null,
      costPrice: variant.costPrice,
      sellingPrice: variant.sellingPrice,
      minimumStock: variant.minimumStock,
      isActive: variant.isActive,
    })),
  };
}

export async function createProduct(
  context: AuthContext,
  input: CreateProductInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertCatalogPermission(context.permissions, "product.create");
  const variants = effectiveVariants(input);
  return db.$transaction(async (transaction) => {
    await lockCatalog(transaction, context.business.id);
    await assertReferences(transaction, context.business.id, input);
    await assertUniqueIdentifiers(
      transaction,
      context.business.id,
      undefined,
      input.sku,
      variants,
    );
    const product = await transaction.product.create({
      data: {
        businessId: context.business.id,
        categoryId: input.categoryId,
        brandId: input.brandId || null,
        unitId: input.unitId,
        name: input.name,
        slug: await uniqueSlug(transaction, context.business.id, input.name),
        description: nullable(input.description),
        sku: input.sku,
        taxable: input.taxable,
        taxRate: decimal(input.taxable ? input.taxRate : "0"),
        trackInventory: input.trackInventory,
        allowNegativeStock: input.trackInventory && input.allowNegativeStock,
        minimumStock: decimal(input.minimumStock),
        isActive: input.isActive,
      },
      select: { id: true },
    });
    for (const variant of variants) {
      await createVariant(
        transaction,
        context.business.id,
        product.id,
        variant,
      );
    }
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.CREATE,
      entityType: "Product",
      entityId: product.id,
      after: auditProductInput(input, variants),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return product.id;
  });
}

export async function updateProduct(
  context: AuthContext,
  input: UpdateProductInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertCatalogPermission(context.permissions, "product.update");
  const variants = effectiveVariants(input);
  await db.$transaction(async (transaction) => {
    await lockCatalog(transaction, context.business.id);
    const existing = await transaction.product.findFirst({
      where: {
        id: input.productId,
        businessId: context.business.id,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        categoryId: true,
        brandId: true,
        unitId: true,
        taxable: true,
        taxRate: true,
        trackInventory: true,
        allowNegativeStock: true,
        minimumStock: true,
        isActive: true,
        variants: { select: { id: true } },
      },
    });
    if (existing === null) {
      throw new CatalogPolicyError("NOT_FOUND", "Product not found.");
    }
    const submittedExistingIds = variants.flatMap(({ id }) => (id ? [id] : []));
    if (
      submittedExistingIds.some(
        (id) => !existing.variants.some((variant) => variant.id === id),
      )
    ) {
      throw new CatalogPolicyError(
        "NOT_FOUND",
        "One or more variants are unavailable.",
      );
    }
    await assertReferences(transaction, context.business.id, input);
    await assertUniqueIdentifiers(
      transaction,
      context.business.id,
      existing.id,
      input.sku,
      variants,
    );
    await transaction.product.update({
      where: { id: existing.id },
      data: {
        categoryId: input.categoryId,
        brandId: input.brandId || null,
        unitId: input.unitId,
        name: input.name,
        slug: await uniqueSlug(
          transaction,
          context.business.id,
          input.name,
          existing.id,
        ),
        description: nullable(input.description),
        sku: input.sku,
        taxable: input.taxable,
        taxRate: decimal(input.taxable ? input.taxRate : "0"),
        trackInventory: input.trackInventory,
        allowNegativeStock: input.trackInventory && input.allowNegativeStock,
        minimumStock: decimal(input.minimumStock),
        isActive: input.isActive,
      },
    });
    for (const variant of variants) {
      if (variant.id === undefined) {
        await createVariant(
          transaction,
          context.business.id,
          existing.id,
          variant,
        );
        continue;
      }
      await transaction.productVariant.update({
        where: { id: variant.id },
        data: {
          name: variant.name,
          sku: variant.sku,
          size: nullable(variant.size),
          color: nullable(variant.color),
          costPrice: decimal(variant.costPrice),
          sellingPrice: decimal(variant.sellingPrice),
          minimumStock: decimal(variant.minimumStock),
          isActive: variant.isActive,
          barcodes: {
            deleteMany: {},
            ...(variant.barcode
              ? {
                  create: {
                    businessId: context.business.id,
                    barcode: variant.barcode,
                    isPrimary: true,
                  },
                }
              : {}),
          },
        },
      });
      const updatedPrices = await transaction.productPrice.updateMany({
        where: {
          productVariantId: variant.id,
          locationId: null,
          priceType: ProductPriceType.RETAIL,
        },
        data: {
          amount: decimal(variant.sellingPrice),
          isActive: variant.isActive,
        },
      });
      if (updatedPrices.count === 0) {
        await transaction.productPrice.create({
          data: {
            businessId: context.business.id,
            productVariantId: variant.id,
            priceType: ProductPriceType.RETAIL,
            amount: decimal(variant.sellingPrice),
            isActive: variant.isActive,
          },
        });
      }
    }
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.UPDATE,
      entityType: "Product",
      entityId: existing.id,
      before: {
        name: existing.name,
        sku: existing.sku,
        categoryId: existing.categoryId,
        brandId: existing.brandId,
        unitId: existing.unitId,
        taxable: existing.taxable,
        taxRate: existing.taxRate.toString(),
        trackInventory: existing.trackInventory,
        allowNegativeStock: existing.allowNegativeStock,
        minimumStock: existing.minimumStock.toString(),
        isActive: existing.isActive,
      },
      after: auditProductInput(input, variants),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function archiveProduct(
  context: AuthContext,
  productId: string,
  metadata: RequestMetadata,
): Promise<void> {
  assertCatalogPermission(context.permissions, "product.archive");
  await db.$transaction(async (transaction) => {
    const product = await transaction.product.findFirst({
      where: {
        id: productId,
        businessId: context.business.id,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        _count: {
          select: {
            saleItems: { where: { sale: { status: SaleStatus.HELD } } },
          },
        },
      },
    });
    if (product === null) {
      throw new CatalogPolicyError("NOT_FOUND", "Product not found.");
    }
    assertProductCanBeArchived(product._count.saleItems);
    const archivedAt = new Date();
    await transaction.product.update({
      where: { id: product.id },
      data: {
        isActive: false,
        archivedAt,
        variants: {
          updateMany: {
            where: { archivedAt: null },
            data: { isActive: false, archivedAt },
          },
        },
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.ARCHIVE,
      entityType: "Product",
      entityId: product.id,
      before: { name: product.name, sku: product.sku, archivedAt: null },
      after: { archivedAt: archivedAt.toISOString() },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

async function referenceSlug(
  transaction: Prisma.TransactionClient,
  model: "category" | "brand",
  businessId: string,
  name: string,
  id?: string,
): Promise<string> {
  const base = slugify(name) || model;
  const existing =
    model === "category"
      ? await transaction.category.findFirst({
          where: { businessId, slug: base, ...(id ? { id: { not: id } } : {}) },
        })
      : await transaction.brand.findFirst({
          where: { businessId, slug: base, ...(id ? { id: { not: id } } : {}) },
        });
  return existing === null
    ? base
    : `${base.slice(0, 125)}-${randomBytes(4).toString("hex")}`;
}

export async function saveCategory(
  context: AuthContext,
  input: CategoryInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertCatalogPermission(context.permissions, "category.manage");
  await db.$transaction(async (transaction) => {
    const slug = await referenceSlug(
      transaction,
      "category",
      context.business.id,
      input.name,
      input.id,
    );
    const record = input.id
      ? await transaction.category.update({
          where: { id: input.id, businessId: context.business.id },
          data: {
            name: input.name,
            slug,
            description: nullable(input.description),
            isActive: input.isActive,
          },
        })
      : await transaction.category.create({
          data: {
            businessId: context.business.id,
            name: input.name,
            slug,
            description: nullable(input.description),
            isActive: input.isActive,
          },
        });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      action: input.id ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Category",
      entityId: record.id,
      after: { name: input.name, isActive: input.isActive },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function saveBrand(
  context: AuthContext,
  input: BrandInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertCatalogPermission(context.permissions, "category.manage");
  await db.$transaction(async (transaction) => {
    const slug = await referenceSlug(
      transaction,
      "brand",
      context.business.id,
      input.name,
      input.id,
    );
    const record = input.id
      ? await transaction.brand.update({
          where: { id: input.id, businessId: context.business.id },
          data: {
            name: input.name,
            slug,
            description: nullable(input.description),
            isActive: input.isActive,
          },
        })
      : await transaction.brand.create({
          data: {
            businessId: context.business.id,
            name: input.name,
            slug,
            description: nullable(input.description),
            isActive: input.isActive,
          },
        });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      action: input.id ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Brand",
      entityId: record.id,
      after: { name: input.name, isActive: input.isActive },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function saveUnit(
  context: AuthContext,
  input: UnitInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertCatalogPermission(context.permissions, "category.manage");
  await db.$transaction(async (transaction) => {
    const record = input.id
      ? await transaction.unit.update({
          where: { id: input.id, businessId: context.business.id },
          data: {
            name: input.name,
            abbreviation: input.abbreviation,
            precision: input.precision,
            isActive: input.isActive,
          },
        })
      : await transaction.unit.create({
          data: {
            businessId: context.business.id,
            name: input.name,
            abbreviation: input.abbreviation,
            precision: input.precision,
            isActive: input.isActive,
          },
        });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      action: input.id ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Unit",
      entityId: record.id,
      after: {
        name: input.name,
        abbreviation: input.abbreviation,
        precision: input.precision,
        isActive: input.isActive,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}
