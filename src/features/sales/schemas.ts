import { z } from "zod";

const decimal = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Use a non-negative monetary amount.");
const quantity = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,4})?$/, "Use a positive quantity.")
  .refine((value) => Number(value) > 0, "Quantity must be greater than zero.");

export const discountSchema = z.object({
  type: z.enum(["FIXED", "PERCENTAGE"]),
  value: decimal,
});

export const saleLineSchema = z.object({
  productVariantId: z.uuid(),
  quantity,
  unitPrice: decimal.optional(),
  priceOverrideReason: z.string().trim().min(3).max(500).optional(),
  discount: discountSchema.optional(),
});

export const salePaymentSchema = z.object({
  paymentMethod: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "MOBILE_WALLET",
    "CREDIT",
  ]),
  amount: decimal.refine(
    (value) => Number(value) > 0,
    "Payment must be positive.",
  ),
  reference: z.string().trim().max(160).optional(),
});

export const checkoutSaleSchema = z.object({
  lines: z.array(saleLineSchema).min(1).max(200),
  customerId: z.uuid().optional(),
  notes: z.string().trim().max(4_000).optional(),
  cartDiscount: discountSchema.optional(),
  payments: z.array(salePaymentSchema).min(1).max(6),
  checkoutRequestId: z.uuid(),
});

export const holdSaleSchema = checkoutSaleSchema.omit({
  payments: true,
  checkoutRequestId: true,
});

export const quickCustomerSchema = z.object({
  name: z.string().trim().min(2).max(180),
  phone: z.string().trim().max(32).optional(),
  email: z.email().optional(),
});

export type CheckoutSaleInput = z.infer<typeof checkoutSaleSchema>;
export type HoldSaleInput = z.infer<typeof holdSaleSchema>;
export type QuickCustomerInput = z.infer<typeof quickCustomerSchema>;

export type SaleActionResult =
  | { success: true; message: string; saleId?: string; receiptNumber?: string }
  | { success: false; message: string; fieldErrors?: Record<string, string[]> };

export const saleReturnSchema = z.object({
  saleId: z.uuid(),
  requestId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  refundMethod: z.enum([
    "CASH",
    "CARD",
    "BANK_TRANSFER",
    "MOBILE_WALLET",
    "CREDIT",
  ]),
  items: z
    .array(
      z.object({
        saleItemId: z.uuid(),
        quantity,
        restockable: z.boolean(),
        nonRestockableReason: z.string().trim().max(500).optional(),
      }),
    )
    .min(1),
});
export const voidSaleSchema = z.object({
  saleId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
});
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
