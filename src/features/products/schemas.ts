import { z } from "zod";

import { assertNoDuplicateVariants } from "@/features/products/policy";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).optional().or(z.literal(""));

export const moneyStringSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,18}(?:\.\d{1,2})?$/,
    "Use a non-negative amount with at most 2 decimal places",
  );

export const quantityStringSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,16}(?:\.\d{1,4})?$/,
    "Use a non-negative quantity with at most 4 decimal places",
  );

export const taxRateStringSchema = z
  .string()
  .trim()
  .regex(
    /^(?:100(?:\.0{1,4})?|(?:\d|[1-9]\d)(?:\.\d{1,4})?)$/,
    "Tax rate must be between 0 and 100 with at most 4 decimal places",
  );

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "SKU is required")
  .max(80)
  .regex(
    /^[A-Z0-9][A-Z0-9._/-]*$/,
    "Use letters, numbers, dots, dashes, slashes, or underscores",
  );

export const barcodeSchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[A-Za-z0-9._-]*$/, "Barcode contains unsupported characters");

export const productVariantSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(160),
  sku: skuSchema,
  barcode: barcodeSchema.optional().or(z.literal("")),
  size: optionalText(80),
  color: optionalText(80),
  costPrice: moneyStringSchema,
  sellingPrice: moneyStringSchema,
  minimumStock: quantityStringSchema,
  isActive: z.boolean(),
});

const productBaseSchema = z
  .object({
    name: z.string().trim().min(2).max(180),
    description: optionalText(5_000),
    sku: skuSchema,
    categoryId: z.uuid(),
    brandId: z.uuid().optional().or(z.literal("")),
    unitId: z.uuid(),
    taxable: z.boolean(),
    taxRate: taxRateStringSchema,
    trackInventory: z.boolean(),
    allowNegativeStock: z.boolean(),
    minimumStock: quantityStringSchema,
    isActive: z.boolean(),
    variants: z.array(productVariantSchema).max(100),
  })
  .superRefine((value, context) => {
    try {
      assertNoDuplicateVariants(value.variants);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["variants"],
        message: error instanceof Error ? error.message : "Invalid variants",
      });
    }
    if (!value.trackInventory && value.allowNegativeStock) {
      context.addIssue({
        code: "custom",
        path: ["allowNegativeStock"],
        message:
          "Negative stock is only relevant for inventory-tracked products",
      });
    }
  });

export const createProductSchema = productBaseSchema;
export const updateProductSchema = productBaseSchema.extend({
  productId: z.uuid(),
});
export const archiveProductSchema = z.object({ productId: z.uuid() });

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: optionalText(500),
  isActive: z.boolean(),
});

export const brandSchema = categorySchema;
export const unitSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().min(1).max(16),
  precision: z.number().int().min(0).max(4),
  isActive: z.boolean(),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type UnitInput = z.infer<typeof unitSchema>;

export type CatalogActionResult =
  | { success: true; message: string; redirectTo?: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };
