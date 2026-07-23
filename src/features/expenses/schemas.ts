import { z } from "zod";
const amount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/);
export const expenseSchema = z.object({
  id: z.uuid().optional(),
  expenseCategoryId: z.uuid(),
  locationId: z.uuid(),
  expenseDate: z.iso.date(),
  vendorName: z.string().trim().max(180).optional(),
  description: z.string().trim().min(3).max(500),
  amount,
  tax: amount.default("0"),
  receiptReference: z.string().trim().max(300).optional(),
});
export const expenseStatusSchema = z.object({
  expenseId: z.uuid(),
  action: z.enum(["SUBMIT", "APPROVE", "REJECT", "PAY", "VOID"]),
  paymentMethod: z
    .enum(["CASH", "CARD", "BANK_TRANSFER", "MOBILE_WALLET", "CREDIT"])
    .optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});
export const expenseCategorySchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseStatusInput = z.infer<typeof expenseStatusSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
