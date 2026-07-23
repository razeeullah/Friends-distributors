import { z } from "zod";

const QUANTITY = /^\d{1,16}(?:\.\d{1,4})?$/;

export const inventoryQuantitySchema = z
  .string()
  .trim()
  .regex(QUANTITY, "Enter a non-negative quantity with at most 4 decimals.");

export const stockAdjustmentSchema = z
  .object({
    locationId: z.uuid("Select a location."),
    adjustmentType: z.enum(["INCREASE", "DECREASE"]),
    reason: z.string().trim().min(3, "A reason is required.").max(300),
    notes: z.string().trim().max(4000).default(""),
    items: z
      .array(
        z.object({
          productVariantId: z.uuid("Select a product variant."),
          countedQuantity: inventoryQuantitySchema,
        }),
      )
      .min(1, "Add at least one item.")
      .max(200),
  })
  .superRefine((value, context) => {
    const variants = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (variants.has(item.productVariantId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productVariantId"],
          message: "The same variant cannot be adjusted twice.",
        });
      }
      variants.add(item.productVariantId);
    }
  });

export const stockAdjustmentIdSchema = z.object({ adjustmentId: z.uuid() });

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export interface InventoryActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string[]>;
}
