import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH } from "@/features/auth/password";
import type { AuthContext } from "@/features/auth/session";
import { InventoryPolicyError } from "@/features/inventory/policy";
import { decreaseStock } from "@/features/inventory/service";
import { Prisma } from "@/generated/prisma/client";
import {
  StockAdjustmentStatus,
  StockMovementType,
  StockReferenceType,
} from "@/generated/prisma/enums";

const hasDatabase =
  process.env.DATABASE_URL?.startsWith("postgresql://") ?? false;

describe.runIf(hasDatabase).sequential("database inventory", () => {
  let db: (typeof import("@/lib/db"))["db"];
  let services: typeof import("@/features/inventory/services");
  let context: AuthContext;
  let locationId: string;
  let variantId: string;
  let productId: string;
  const metadata = { ipAddress: "192.0.2.70", userAgent: "vitest-phase7" };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    services = await import("@/features/inventory/services");
    const business = await db.business.upsert({
      where: { slug: "phase7-inventory-test" },
      update: { archivedAt: null },
      create: { slug: "phase7-inventory-test", name: "Phase 7 Inventory Test" },
    });
    const location = await db.location.upsert({
      where: { businessId_code: { businessId: business.id, code: "TEST" } },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, code: "TEST", name: "Test Location" },
    });
    const category = await db.category.upsert({
      where: {
        businessId_slug: { businessId: business.id, slug: "inventory-test" },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        slug: "inventory-test",
        name: "Inventory Test",
      },
    });
    const unit = await db.unit.upsert({
      where: {
        businessId_abbreviation: {
          businessId: business.id,
          abbreviation: "it",
        },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        abbreviation: "it",
        name: "Inventory Test Unit",
      },
    });
    const product = await db.product.upsert({
      where: {
        businessId_sku: { businessId: business.id, sku: "INVENTORY-TEST" },
      },
      update: { isActive: true, archivedAt: null, allowNegativeStock: false },
      create: {
        businessId: business.id,
        categoryId: category.id,
        unitId: unit.id,
        name: "Inventory Test Product",
        slug: "inventory-test-product",
        sku: "INVENTORY-TEST",
        allowNegativeStock: false,
      },
    });
    const actor = await db.user.upsert({
      where: { email: "phase7-inventory-actor@test.local" },
      update: {
        businessId: business.id,
        defaultLocationId: location.id,
        status: "ACTIVE",
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        defaultLocationId: location.id,
        email: "phase7-inventory-actor@test.local",
        username: "phase7-inventory-actor",
        displayName: "Phase 7 Inventory Actor",
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
    locationId = location.id;
    productId = product.id;
    context = {
      sessionId: "00000000-0000-4000-8000-000000000007",
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
      permissions: new Set(["inventory.view", "inventory.adjust"]),
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

  beforeEach(async () => {
    const suffix = randomUUID().slice(0, 8);
    const variant = await db.productVariant.create({
      data: {
        businessId: context.business.id,
        productId,
        name: `Test ${suffix}`,
        sku: `INVENTORY-TEST-V-${suffix}`,
        costPrice: "10",
        sellingPrice: "15",
        minimumStock: "2",
      },
    });
    variantId = variant.id;
  });

  async function draft(
    type: "INCREASE" | "DECREASE",
    countedQuantity: string,
    suffix: string,
  ) {
    return services.createStockAdjustment(
      context,
      {
        locationId,
        adjustmentType: type,
        reason: `Stocktake ${suffix}`,
        notes: "Integration test",
        items: [{ productVariantId: variantId, countedQuantity }],
      },
      metadata,
    );
  }

  async function balance() {
    return db.inventoryBalance.findUnique({
      where: {
        businessId_locationId_productVariantId: {
          businessId: context.business.id,
          locationId,
          productVariantId: variantId,
        },
      },
    });
  }

  it("creates a draft without changing stock, then posts an adjustment in", async () => {
    const adjustmentId = await draft("INCREASE", "10", "IN");
    expect((await balance())?.quantity.toString() ?? "0").toBe("0");
    await services.postStockAdjustment(context, adjustmentId, metadata);
    const [adjustment, current, movement] = await Promise.all([
      db.stockAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
        include: { items: true },
      }),
      balance(),
      db.stockMovement.findFirstOrThrow({
        where: {
          referenceId: adjustmentId,
          movementType: StockMovementType.ADJUSTMENT_IN,
        },
      }),
    ]);
    expect(adjustment.status).toBe(StockAdjustmentStatus.COMPLETED);
    expect(adjustment.items[0]!.systemQuantity.toString()).toBe("0");
    expect(adjustment.items[0]!.quantityChange.toString()).toBe("10");
    expect(current?.quantity.toString()).toBe("10");
    expect(movement).toMatchObject({
      quantityBefore: expect.anything(),
      referenceType: StockReferenceType.STOCK_ADJUSTMENT,
      referenceLineId: adjustment.items[0]!.id,
    });
    expect(movement.quantityBefore.toString()).toBe("0");
    expect(movement.quantityChange.toString()).toBe("10");
    expect(movement.quantityAfter.toString()).toBe("10");
  });

  it("posts an adjustment out and records an accurate ledger transition", async () => {
    const setupAdjustmentId = await draft("INCREASE", "10", "OUT-SETUP");
    await services.postStockAdjustment(context, setupAdjustmentId, metadata);
    const adjustmentId = await draft("DECREASE", "6", "OUT");
    await services.postStockAdjustment(context, adjustmentId, metadata);
    const movement = await db.stockMovement.findFirstOrThrow({
      where: {
        referenceId: adjustmentId,
        movementType: StockMovementType.ADJUSTMENT_OUT,
      },
    });
    expect(movement.quantityBefore.toString()).toBe("10");
    expect(movement.quantityChange.toString()).toBe("-4");
    expect(movement.quantityAfter.toString()).toBe("6");
  });

  it("blocks negative stock through the reusable decrease service", async () => {
    await expect(
      db.$transaction((transaction) =>
        decreaseStock(transaction, {
          businessId: context.business.id,
          locationId,
          productVariantId: variantId,
          quantity: new Prisma.Decimal("-7"),
          movementType: StockMovementType.ADJUSTMENT_OUT,
          referenceType: StockReferenceType.STOCK_ADJUSTMENT,
          referenceId: randomUUID(),
          performedById: context.user.id,
        }),
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<InventoryPolicyError>>({
        code: "NEGATIVE_STOCK",
      }),
    );
  });

  it("prevents posting the same adjustment twice", async () => {
    const adjustmentId = await draft("INCREASE", "8", "TWICE");
    await services.postStockAdjustment(context, adjustmentId, metadata);
    await expect(
      services.postStockAdjustment(context, adjustmentId, metadata),
    ).rejects.toEqual(
      expect.objectContaining<Partial<InventoryPolicyError>>({
        code: "INVALID_STATUS",
      }),
    );
  });

  it("serializes concurrent adjustment posts against one balance", async () => {
    const [firstId, secondId] = await Promise.all([
      draft("INCREASE", "10", "CON-A"),
      draft("INCREASE", "12", "CON-B"),
    ]);
    const results = await Promise.allSettled([
      services.postStockAdjustment(context, firstId, metadata),
      services.postStockAdjustment(context, secondId, metadata),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<void> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(
      rejected.every((result) => result.reason instanceof InventoryPolicyError),
    ).toBe(true);
    expect(["10", "12"]).toContain((await balance())?.quantity.toString());
    const completed = await db.stockAdjustment.count({
      where: {
        id: { in: [firstId, secondId] },
        status: StockAdjustmentStatus.COMPLETED,
      },
    });
    expect(completed).toBe(fulfilled.length);
  });
});
