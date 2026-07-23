import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH } from "@/features/auth/password";
import type { AuthContext } from "@/features/auth/session";
import { CatalogPolicyError } from "@/features/products/policy";
import type { CreateProductInput } from "@/features/products/schemas";
import { SaleStatus } from "@/generated/prisma/enums";

const hasDatabase =
  process.env.DATABASE_URL?.startsWith("postgresql://") ?? false;

describe.runIf(hasDatabase).sequential("database product catalog", () => {
  let db: (typeof import("@/lib/db"))["db"];
  let services: typeof import("@/features/products/services");
  let queries: typeof import("@/features/products/queries");
  let context: AuthContext;
  let categoryId: string;
  let unitId: string;
  let locationId: string;
  const runId = randomUUID().slice(0, 8).toUpperCase();

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    services = await import("@/features/products/services");
    queries = await import("@/features/products/queries");
    const business = await db.business.upsert({
      where: { slug: "phase5-catalog-test" },
      update: { archivedAt: null },
      create: { slug: "phase5-catalog-test", name: "Phase 5 Catalog Test" },
    });
    const location = await db.location.upsert({
      where: { businessId_code: { businessId: business.id, code: "TEST" } },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, code: "TEST", name: "Test Location" },
    });
    const category = await db.category.upsert({
      where: { businessId_slug: { businessId: business.id, slug: "test" } },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, name: "Test", slug: "test" },
    });
    const unit = await db.unit.upsert({
      where: {
        businessId_abbreviation: {
          businessId: business.id,
          abbreviation: "pc",
        },
      },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, name: "Piece", abbreviation: "pc" },
    });
    const actor = await db.user.upsert({
      where: { email: "phase5-catalog-actor@test.local" },
      update: {
        businessId: business.id,
        defaultLocationId: location.id,
        status: "ACTIVE",
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        defaultLocationId: location.id,
        email: "phase5-catalog-actor@test.local",
        username: "phase5-catalog-actor",
        displayName: "Phase 5 Catalog Actor",
        passwordHash: DUMMY_PASSWORD_HASH,
      },
    });
    await db.userLocation.upsert({
      where: {
        userId_locationId: { userId: actor.id, locationId: location.id },
      },
      update: { businessId: business.id },
      create: {
        businessId: business.id,
        userId: actor.id,
        locationId: location.id,
      },
    });

    categoryId = category.id;
    unitId = unit.id;
    locationId = location.id;
    context = {
      sessionId: "00000000-0000-4000-8000-000000000005",
      expiresAt: new Date(Date.now() + 60_000),
      rememberMe: false,
      user: {
        id: actor.id,
        businessId: business.id,
        email: actor.email,
        username: actor.username,
        displayName: actor.displayName,
      },
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        currencyCode: business.currencyCode,
        timezone: business.timezone,
        locale: business.locale,
      },
      roles: [],
      roleCodes: [],
      permissions: new Set([
        "product.view",
        "product.create",
        "product.update",
        "product.archive",
        "category.manage",
      ]),
      locations: [
        { id: location.id, code: location.code, name: location.name },
      ],
      currentLocation: {
        id: location.id,
        code: location.code,
        name: location.name,
      },
    };
  });

  function productInput(input: {
    productSku: string;
    variantSku?: string;
    barcode?: string;
    variants?: CreateProductInput["variants"];
  }): CreateProductInput {
    return {
      name: `Test Product ${input.productSku}`,
      description: "Database catalog test",
      sku: input.productSku,
      categoryId,
      brandId: "",
      unitId,
      taxable: true,
      taxRate: "18.0000",
      trackInventory: true,
      allowNegativeStock: false,
      minimumStock: "2.0000",
      isActive: true,
      variants: input.variants ?? [
        {
          name: "Default",
          sku: input.variantSku ?? input.productSku,
          barcode: input.barcode ?? "",
          size: "",
          color: "",
          costPrice: "100.00",
          sellingPrice: "125.00",
          minimumStock: "2.0000",
          isActive: true,
        },
      ],
    };
  }

  const metadata = { ipAddress: "192.0.2.50", userAgent: "vitest-phase5" };

  it("enforces business-wide SKU uniqueness", async () => {
    const duplicateSku = `DUP-${runId}`;
    await services.createProduct(
      context,
      productInput({ productSku: `BASE-A-${runId}`, variantSku: duplicateSku }),
      metadata,
    );
    await expect(
      services.createProduct(
        context,
        productInput({
          productSku: `BASE-B-${runId}`,
          variantSku: duplicateSku,
        }),
        metadata,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "SKU_CONFLICT",
      }),
    );
  });

  it("enforces business-wide barcode uniqueness", async () => {
    const barcode = `BC${runId}`;
    await services.createProduct(
      context,
      productInput({ productSku: `BAR-A-${runId}`, barcode }),
      metadata,
    );
    await expect(
      services.createProduct(
        context,
        productInput({ productSku: `BAR-B-${runId}`, barcode }),
        metadata,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "BARCODE_CONFLICT",
      }),
    );
  });

  it("creates a default variant when none are submitted", async () => {
    const sku = `DEFAULT-${runId}`;
    const productId = await services.createProduct(
      context,
      productInput({ productSku: sku, variants: [] }),
      metadata,
    );
    const variant = await db.productVariant.findFirstOrThrow({
      where: { productId },
      select: { name: true, sku: true, sellingPrice: true },
    });
    expect(variant).toMatchObject({ name: "Default", sku });
    expect(variant.sellingPrice.toString()).toBe("0");
    const listing = await queries.listProducts(
      context.business.id,
      locationId,
      { search: sku, status: "active", page: 1, pageSize: 25 },
    );
    expect(listing.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productId, sku, variantCount: 1 }),
      ]),
    );
  });

  it("blocks archiving a product referenced by a held sale", async () => {
    const productId = await services.createProduct(
      context,
      productInput({ productSku: `HELD-${runId}` }),
      metadata,
    );
    const variant = await db.productVariant.findFirstOrThrow({
      where: { productId },
    });
    await db.sale.create({
      data: {
        businessId: context.business.id,
        locationId,
        receiptNumber: `HELD-${runId}`,
        status: SaleStatus.HELD,
        cashierId: context.user.id,
        items: {
          create: {
            productId,
            productVariantId: variant.id,
            productNameSnapshot: "Held Product",
            variantNameSnapshot: variant.name,
            skuSnapshot: variant.sku,
            quantity: "1",
            unitPrice: "125.00",
            originalUnitPrice: "125.00",
            unitCost: "100.00",
            lineSubtotal: "125.00",
            lineTotal: "125.00",
            lineCost: "100.00",
            lineProfit: "25.00",
          },
        },
      },
    });
    await expect(
      services.archiveProduct(context, productId, metadata),
    ).rejects.toEqual(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "HELD_CART",
      }),
    );
    await expect(
      db.product.findUniqueOrThrow({ where: { id: productId } }),
    ).resolves.toMatchObject({ archivedAt: null });
  });
});
