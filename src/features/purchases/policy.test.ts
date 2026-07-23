import { describe, expect, it } from "vitest";

import {
  assertPurchaseCancellable,
  assertPurchaseEditable,
  assertPurchasePermission,
  PurchasePolicyError,
} from "@/features/purchases/policy";
import {
  createPurchaseSchema,
  moneySchema,
  quantitySchema,
} from "@/features/purchases/schemas";
import { PurchaseStatus } from "@/generated/prisma/enums";

describe("purchase policies", () => {
  it("enforces permissions", () => {
    expect(() =>
      assertPurchasePermission(new Set(["purchase.view"]), "purchase.receive"),
    ).toThrowError(
      expect.objectContaining<Partial<PurchasePolicyError>>({
        code: "FORBIDDEN",
      }),
    );
  });

  it("allows editing only while draft", () => {
    expect(() => assertPurchaseEditable(PurchaseStatus.DRAFT)).not.toThrow();
    expect(() => assertPurchaseEditable(PurchaseStatus.RECEIVED)).toThrow();
  });

  it("allows cancellation only before receiving", () => {
    expect(() =>
      assertPurchaseCancellable(PurchaseStatus.ORDERED, false),
    ).not.toThrow();
    expect(() =>
      assertPurchaseCancellable(PurchaseStatus.ORDERED, true),
    ).toThrow();
  });

  it("validates Decimal-safe amount precision", () => {
    expect(moneySchema.safeParse("10.01").success).toBe(true);
    expect(moneySchema.safeParse("10.001").success).toBe(false);
    expect(moneySchema.safeParse("-1").success).toBe(false);
    expect(quantitySchema.safeParse("1.2345").success).toBe(true);
    expect(quantitySchema.safeParse("1.23456").success).toBe(false);
  });

  it("rejects duplicate variants in a purchase", () => {
    const variantId = "00000000-0000-4000-8000-000000000001";
    const result = createPurchaseSchema.safeParse({
      supplierId: "00000000-0000-4000-8000-000000000002",
      locationId: "00000000-0000-4000-8000-000000000003",
      supplierInvoiceNumber: "",
      purchaseDate: "2026-07-21",
      notes: "",
      items: [
        {
          productVariantId: variantId,
          quantity: "1",
          unitCost: "10",
          discount: "0",
          tax: "0",
        },
        {
          productVariantId: variantId,
          quantity: "2",
          unitCost: "10",
          discount: "0",
          tax: "0",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
