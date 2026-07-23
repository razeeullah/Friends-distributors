import { z } from "zod";

const MONEY = /^\d{1,18}(?:\.\d{1,2})?$/;
const QUANTITY = /^\d{1,16}(?:\.\d{1,4})?$/;

export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY, "Enter a non-negative amount with at most 2 decimals.");

export const positiveMoneySchema = moneySchema.refine(
  (value) => !/^0+(?:\.0+)?$/.test(value),
  "Amount must be greater than zero.",
);

export const quantitySchema = z
  .string()
  .trim()
  .regex(QUANTITY, "Enter a non-negative quantity with at most 4 decimals.");

export const positiveQuantitySchema = quantitySchema.refine(
  (value) => !/^0+(?:\.0+)?$/.test(value),
  "Quantity must be greater than zero.",
);

export const supplierSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1, "Supplier code is required.")
    .max(40)
    .transform((value) => value.toLocaleUpperCase("en")),
  name: z.string().trim().min(1, "Supplier name is required.").max(180),
  contactName: z.string().trim().max(160).default(""),
  email: z.union([z.literal(""), z.email()]).default(""),
  phone: z.string().trim().max(32).default(""),
  address: z.string().trim().max(2000).default(""),
  taxRegistrationNumber: z.string().trim().max(80).default(""),
  paymentTermsDays: z.coerce.number().int().min(0).max(3650),
  openingBalance: moneySchema,
  isActive: z.boolean(),
});

export const purchaseLineSchema = z.object({
  id: z.uuid().optional(),
  productVariantId: z.uuid("Select a product variant."),
  quantity: positiveQuantitySchema,
  unitCost: moneySchema,
  discount: moneySchema,
  tax: moneySchema,
});

const purchaseBaseSchema = z
  .object({
    supplierId: z.uuid("Select a supplier."),
    locationId: z.uuid("Select a location."),
    supplierInvoiceNumber: z.string().trim().max(100).default(""),
    purchaseDate: z.iso.date(),
    notes: z.string().trim().max(4000).default(""),
    items: z
      .array(purchaseLineSchema)
      .min(1, "Add at least one item.")
      .max(200),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (ids.has(item.productVariantId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "productVariantId"],
          message: "The same variant cannot be added twice.",
        });
      }
      ids.add(item.productVariantId);
    }
  });

export const createPurchaseSchema = purchaseBaseSchema;
export const updatePurchaseSchema = purchaseBaseSchema.extend({
  purchaseId: z.uuid(),
});

export const purchaseIdSchema = z.object({ purchaseId: z.uuid() });

export const receivePurchaseSchema = z.object({
  purchaseId: z.uuid(),
  items: z
    .array(
      z.object({
        purchaseItemId: z.uuid(),
        quantity: quantitySchema,
      }),
    )
    .min(1)
    .max(200)
    .refine(
      (items) =>
        new Set(items.map(({ purchaseItemId }) => purchaseItemId)).size ===
        items.length,
      "A purchase item can appear only once in a receipt.",
    )
    .refine(
      (items) => items.some((item) => !/^0+(?:\.0+)?$/.test(item.quantity)),
      "Enter at least one quantity to receive.",
    ),
});

export const purchasePaymentSchema = z.object({
  purchaseId: z.uuid(),
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "MOBILE_WALLET",
    "STORE_CREDIT",
    "OTHER",
  ]),
  amount: positiveMoneySchema,
  reference: z.string().trim().max(160).default(""),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
export type PurchasePaymentInput = z.infer<typeof purchasePaymentSchema>;

export interface PurchaseActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string[]>;
}
