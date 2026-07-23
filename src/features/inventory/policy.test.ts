import { describe, expect, it } from "vitest";

import {
  assertAdjustmentDraft,
  assertInventoryPermission,
  InventoryPolicyError,
} from "@/features/inventory/policy";
import {
  inventoryQuantitySchema,
  stockAdjustmentSchema,
} from "@/features/inventory/schemas";
import { StockAdjustmentStatus } from "@/generated/prisma/enums";

describe("inventory policies", () => {
  it("enforces adjustment permission", () => {
    expect(() =>
      assertInventoryPermission(
        new Set(["inventory.view"]),
        "inventory.adjust",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<InventoryPolicyError>>({
        code: "FORBIDDEN",
      }),
    );
  });

  it("allows only draft adjustments to post", () => {
    expect(() =>
      assertAdjustmentDraft(StockAdjustmentStatus.DRAFT),
    ).not.toThrow();
    expect(() =>
      assertAdjustmentDraft(StockAdjustmentStatus.COMPLETED),
    ).toThrow();
  });

  it("validates fixed-precision counted quantities", () => {
    expect(inventoryQuantitySchema.safeParse("12.3456").success).toBe(true);
    expect(inventoryQuantitySchema.safeParse("12.34567").success).toBe(false);
    expect(inventoryQuantitySchema.safeParse("-1").success).toBe(false);
  });

  it("rejects duplicate variants in one adjustment", () => {
    const variantId = "00000000-0000-4000-8000-000000000001";
    const result = stockAdjustmentSchema.safeParse({
      locationId: "00000000-0000-4000-8000-000000000002",
      adjustmentType: "INCREASE",
      reason: "Stocktake correction",
      notes: "",
      items: [
        { productVariantId: variantId, countedQuantity: "2" },
        { productVariantId: variantId, countedQuantity: "3" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
