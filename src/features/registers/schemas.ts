import { z } from "zod";
const amount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/);
export const openRegisterSchema = z.object({
  registerId: z.uuid(),
  openingCash: amount,
  notes: z.string().trim().max(1000).optional(),
});
export const cashMovementSchema = z.object({
  registerSessionId: z.uuid(),
  type: z.enum(["CASH_IN", "CASH_OUT"]),
  amount: amount.refine((value) => Number(value) > 0),
  reason: z.string().trim().min(3).max(500),
});
export const closeRegisterSchema = z.object({
  registerSessionId: z.uuid(),
  countedCash: amount,
  notes: z.string().trim().max(1000).optional(),
});
export type OpenRegisterInput = z.infer<typeof openRegisterSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CloseRegisterInput = z.infer<typeof closeRegisterSchema>;
