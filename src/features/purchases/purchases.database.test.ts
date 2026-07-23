import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH } from "@/features/auth/password";
import type { AuthContext } from "@/features/auth/session";
import { PurchasePolicyError } from "@/features/purchases/policy";
import { PurchaseStatus, StockMovementType } from "@/generated/prisma/enums";

const hasDatabase =
  process.env.DATABASE_URL?.startsWith("postgresql://") ?? false;

describe.runIf(hasDatabase).sequential("database purchases", () => {
  let db: (typeof import("@/lib/db"))["db"];
  let services: typeof import("@/features/purchases/services");
  let context: AuthContext;
  let supplierId: string;
  let locationId: string;
  let variantId: string;
  const runId = randomUUID().slice(0, 8).toUpperCase();
  const metadata = { ipAddress: "192.0.2.60", userAgent: "vitest-phase6" };

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    services = await import("@/features/purchases/services");
    const business = await db.business.upsert({
      where: { slug: "phase6-purchase-test" },
      update: { archivedAt: null },
      create: { slug: "phase6-purchase-test", name: "Phase 6 Purchase Test" },
    });
    const location = await db.location.upsert({
      where: { businessId_code: { businessId: business.id, code: "TEST" } },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, code: "TEST", name: "Test Location" },
    });
    const supplier = await db.supplier.upsert({
      where: { businessId_code: { businessId: business.id, code: "SUP-TEST" } },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        code: "SUP-TEST",
        name: "Test Supplier",
      },
    });
    const category = await db.category.upsert({
      where: {
        businessId_slug: { businessId: business.id, slug: "purchase-test" },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        slug: "purchase-test",
        name: "Purchase Test",
      },
    });
    const unit = await db.unit.upsert({
      where: {
        businessId_abbreviation: {
          businessId: business.id,
          abbreviation: "pt",
        },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        abbreviation: "pt",
        name: "Purchase Test Unit",
      },
    });
    const product = await db.product.upsert({
      where: {
        businessId_sku: { businessId: business.id, sku: "PURCHASE-TEST" },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        categoryId: category.id,
        unitId: unit.id,
        name: "Purchase Test Product",
        slug: "purchase-test-product",
        sku: "PURCHASE-TEST",
      },
    });
    const variant = await db.productVariant.upsert({
      where: {
        businessId_sku: { businessId: business.id, sku: "PURCHASE-TEST-V" },
      },
      update: { isActive: true, archivedAt: null },
      create: {
        businessId: business.id,
        productId: product.id,
        name: "Default",
        sku: "PURCHASE-TEST-V",
        costPrice: "100",
        sellingPrice: "120",
      },
    });
    const actor = await db.user.upsert({
      where: { email: "phase6-purchase-actor@test.local" },
      update: {
        businessId: business.id,
        defaultLocationId: location.id,
        status: "ACTIVE",
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        defaultLocationId: location.id,
        email: "phase6-purchase-actor@test.local",
        username: "phase6-purchase-actor",
        displayName: "Phase 6 Purchase Actor",
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
    supplierId = supplier.id;
    locationId = location.id;
    variantId = variant.id;
    context = {
      sessionId: "00000000-0000-4000-8000-000000000006",
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
        "supplier.manage",
        "purchase.view",
        "purchase.create",
        "purchase.receive",
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

  async function draft(
    quantity: string,
    suffix: string,
    discount = "0",
    tax = "0",
  ) {
    return services.createPurchase(
      context,
      {
        supplierId,
        locationId,
        supplierInvoiceNumber: `INV-${runId}-${suffix}`,
        purchaseDate: "2026-07-21",
        notes: "Integration test",
        items: [
          {
            productVariantId: variantId,
            quantity,
            unitCost: "100",
            discount,
            tax,
          },
        ],
      },
      metadata,
    );
  }

  async function ordered(quantity: string, suffix: string) {
    const id = await draft(quantity, suffix);
    await services.markPurchaseOrdered(context, id, metadata);
    return id;
  }

  it("fully receives stock and creates an immutable ledger movement", async () => {
    const purchaseId = await ordered("5", "FULL");
    const purchase = await db.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { items: true },
    });
    const before = await db.inventoryBalance.findUnique({
      where: {
        businessId_locationId_productVariantId: {
          businessId: context.business.id,
          locationId,
          productVariantId: variantId,
        },
      },
    });
    await services.receivePurchase(
      context,
      {
        purchaseId,
        items: [{ purchaseItemId: purchase.items[0]!.id, quantity: "5" }],
      },
      metadata,
    );
    const [updated, movement] = await Promise.all([
      db.purchase.findUniqueOrThrow({
        where: { id: purchaseId },
        include: { items: true },
      }),
      db.stockMovement.findFirstOrThrow({
        where: {
          referenceId: purchaseId,
          referenceLineId: purchase.items[0]!.id,
          movementType: StockMovementType.PURCHASE,
        },
      }),
    ]);
    expect(updated.status).toBe(PurchaseStatus.RECEIVED);
    expect(updated.items[0]!.receivedQuantity.toString()).toBe("5");
    expect(movement.quantityBefore.toString()).toBe(
      before?.quantity.toString() ?? "0",
    );
    expect(movement.quantityAfter.sub(movement.quantityBefore).toString()).toBe(
      "5",
    );
    expect(movement.unitCost?.toString()).toBe("100");
  });

  it("supports partial receipts and prevents duplicate over-receiving", async () => {
    const purchaseId = await ordered("10", "PARTIAL");
    const item = await db.purchaseItem.findFirstOrThrow({
      where: { purchaseId },
    });
    await services.receivePurchase(
      context,
      { purchaseId, items: [{ purchaseItemId: item.id, quantity: "4" }] },
      metadata,
    );
    await expect(
      db.purchase.findUniqueOrThrow({ where: { id: purchaseId } }),
    ).resolves.toMatchObject({ status: PurchaseStatus.PARTIALLY_RECEIVED });
    await expect(
      services.receivePurchase(
        context,
        { purchaseId, items: [{ purchaseItemId: item.id, quantity: "7" }] },
        metadata,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PurchasePolicyError>>({
        code: "OVER_RECEIPT",
      }),
    );
    await services.receivePurchase(
      context,
      { purchaseId, items: [{ purchaseItemId: item.id, quantity: "6" }] },
      metadata,
    );
    await expect(
      services.receivePurchase(
        context,
        { purchaseId, items: [{ purchaseItemId: item.id, quantity: "1" }] },
        metadata,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PurchasePolicyError>>({
        code: "INVALID_STATUS",
      }),
    );
  });

  it("serializes concurrent inventory balance updates", async () => {
    const [firstId, secondId] = await Promise.all([
      ordered("2", "CON-A"),
      ordered("3", "CON-B"),
    ]);
    const [firstItem, secondItem] = await Promise.all([
      db.purchaseItem.findFirstOrThrow({ where: { purchaseId: firstId } }),
      db.purchaseItem.findFirstOrThrow({ where: { purchaseId: secondId } }),
    ]);
    const before = await db.inventoryBalance.findUniqueOrThrow({
      where: {
        businessId_locationId_productVariantId: {
          businessId: context.business.id,
          locationId,
          productVariantId: variantId,
        },
      },
    });
    await Promise.all([
      services.receivePurchase(
        context,
        {
          purchaseId: firstId,
          items: [{ purchaseItemId: firstItem.id, quantity: "2" }],
        },
        metadata,
      ),
      services.receivePurchase(
        context,
        {
          purchaseId: secondId,
          items: [{ purchaseItemId: secondItem.id, quantity: "3" }],
        },
        metadata,
      ),
    ]);
    const after = await db.inventoryBalance.findUniqueOrThrow({
      where: {
        businessId_locationId_productVariantId: {
          businessId: context.business.id,
          locationId,
          productVariantId: variantId,
        },
      },
    });
    expect(after.quantity.sub(before.quantity).toString()).toBe("5");
  });

  it("recalculates payments and purchase balance", async () => {
    const purchaseId = await draft("2", "PAY", "10", "5");
    await services.recordPurchasePayment(
      context,
      {
        purchaseId,
        paymentMethod: "BANK_TRANSFER",
        amount: "50",
        reference: "BANK-1",
      },
      metadata,
    );
    const purchase = await db.purchase.findUniqueOrThrow({
      where: { id: purchaseId },
    });
    expect(purchase.total.toString()).toBe("195");
    expect(purchase.paidAmount.toString()).toBe("50");
    expect(purchase.balance.toString()).toBe("145");
    await expect(
      services.recordPurchasePayment(
        context,
        { purchaseId, paymentMethod: "CASH", amount: "146", reference: "" },
        metadata,
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PurchasePolicyError>>({
        code: "PAYMENT_EXCEEDS_BALANCE",
      }),
    );
  });

  it("cancels only unreceived purchases", async () => {
    const cancellableId = await ordered("1", "CANCEL");
    await services.cancelPurchase(context, cancellableId, metadata);
    await expect(
      db.purchase.findUniqueOrThrow({ where: { id: cancellableId } }),
    ).resolves.toMatchObject({ status: PurchaseStatus.CANCELLED });
    const receivedId = await ordered("1", "NO-CANCEL");
    const item = await db.purchaseItem.findFirstOrThrow({
      where: { purchaseId: receivedId },
    });
    await services.receivePurchase(
      context,
      {
        purchaseId: receivedId,
        items: [{ purchaseItemId: item.id, quantity: "1" }],
      },
      metadata,
    );
    await expect(
      services.cancelPurchase(context, receivedId, metadata),
    ).rejects.toEqual(
      expect.objectContaining<Partial<PurchasePolicyError>>({
        code: "INVALID_STATUS",
      }),
    );
  });
});
