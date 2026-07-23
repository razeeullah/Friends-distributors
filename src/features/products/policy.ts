import type { PermissionKey } from "@/features/auth/permissions";

export class CatalogPolicyError extends Error {
  readonly code:
    | "SKU_CONFLICT"
    | "BARCODE_CONFLICT"
    | "DUPLICATE_VARIANT"
    | "HELD_CART"
    | "FORBIDDEN"
    | "NOT_FOUND";

  constructor(code: CatalogPolicyError["code"], message: string) {
    super(message);
    this.name = "CatalogPolicyError";
    this.code = code;
  }
}

export interface VariantIdentity {
  id?: string | undefined;
  name: string;
  sku: string;
  barcode?: string | undefined;
  size?: string | undefined;
  color?: string | undefined;
}

function normalized(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase("en") ?? "";
}

export function variantSignature(variant: VariantIdentity): string {
  return [variant.name, variant.size, variant.color].map(normalized).join("|");
}

export function assertNoDuplicateVariants(
  variants: readonly VariantIdentity[],
): void {
  const signatures = new Set<string>();
  const skus = new Set<string>();
  const barcodes = new Set<string>();

  for (const variant of variants) {
    const signature = variantSignature(variant);
    if (signatures.has(signature)) {
      throw new CatalogPolicyError(
        "DUPLICATE_VARIANT",
        "Variant name, size, and color combinations must be unique.",
      );
    }
    signatures.add(signature);

    const sku = variant.sku.trim().toLocaleUpperCase("en");
    if (skus.has(sku)) {
      throw new CatalogPolicyError(
        "SKU_CONFLICT",
        "Variant SKUs must be unique.",
      );
    }
    skus.add(sku);

    const barcode = variant.barcode?.trim();
    if (barcode) {
      if (barcodes.has(barcode)) {
        throw new CatalogPolicyError(
          "BARCODE_CONFLICT",
          "Variant barcodes must be unique.",
        );
      }
      barcodes.add(barcode);
    }
  }
}

export function assertProductCanBeArchived(heldCartCount: number): void {
  if (!Number.isSafeInteger(heldCartCount) || heldCartCount < 0) {
    throw new RangeError("Held-cart count must be a non-negative integer");
  }
  if (heldCartCount > 0) {
    throw new CatalogPolicyError(
      "HELD_CART",
      "This product is present in a held sale. Resume or void the held sale before archiving it.",
    );
  }
}

export function assertCatalogPermission(
  permissions: ReadonlySet<string>,
  permission: PermissionKey,
): void {
  if (!permissions.has(permission)) {
    throw new CatalogPolicyError(
      "FORBIDDEN",
      `Missing catalog permission: ${permission}`,
    );
  }
}
