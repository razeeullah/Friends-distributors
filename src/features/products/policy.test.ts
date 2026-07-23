import { describe, expect, it } from "vitest";

import {
  assertCatalogPermission,
  assertNoDuplicateVariants,
  assertProductCanBeArchived,
  CatalogPolicyError,
} from "@/features/products/policy";
import {
  createProductSchema,
  moneyStringSchema,
} from "@/features/products/schemas";

describe("product catalog policies", () => {
  it("rejects duplicate variant identities", () => {
    expect(() =>
      assertNoDuplicateVariants([
        { name: "Large", sku: "SKU-L-1", size: "L", color: "Black" },
        { name: "large", sku: "SKU-L-2", size: " l ", color: "black" },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "DUPLICATE_VARIANT",
      }),
    );
  });

  it("rejects duplicate submitted SKUs and barcodes", () => {
    expect(() =>
      assertNoDuplicateVariants([
        { name: "Small", sku: "DUP-SKU", barcode: "10001" },
        { name: "Large", sku: "dup-sku", barcode: "10002" },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "SKU_CONFLICT",
      }),
    );
    expect(() =>
      assertNoDuplicateVariants([
        { name: "Small", sku: "SKU-1", barcode: "10001" },
        { name: "Large", sku: "SKU-2", barcode: "10001" },
      ]),
    ).toThrowError(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "BARCODE_CONFLICT",
      }),
    );
  });

  it("blocks archiving while a product is in a held cart", () => {
    expect(() => assertProductCanBeArchived(1)).toThrowError(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "HELD_CART",
      }),
    );
    expect(() => assertProductCanBeArchived(0)).not.toThrow();
  });

  it("enforces catalog permissions", () => {
    expect(() =>
      assertCatalogPermission(new Set(["product.view"]), "product.update"),
    ).toThrowError(
      expect.objectContaining<Partial<CatalogPolicyError>>({
        code: "FORBIDDEN",
      }),
    );
    expect(() =>
      assertCatalogPermission(new Set(["product.update"]), "product.update"),
    ).not.toThrow();
  });

  it("rejects negative or over-precision prices", () => {
    expect(moneyStringSchema.safeParse("-0.01").success).toBe(false);
    expect(moneyStringSchema.safeParse("10.001").success).toBe(false);
    expect(moneyStringSchema.safeParse("10.01").success).toBe(true);
  });

  it("accepts a product without submitted variants for default-variant creation", () => {
    const result = createProductSchema.safeParse({
      name: "Simple Product",
      description: "",
      sku: "SIMPLE-1",
      categoryId: "00000000-0000-4000-8000-000000000001",
      brandId: "",
      unitId: "00000000-0000-4000-8000-000000000002",
      taxable: false,
      taxRate: "0",
      trackInventory: true,
      allowNegativeStock: false,
      minimumStock: "0",
      isActive: true,
      variants: [],
    });
    expect(result.success).toBe(true);
  });
});
