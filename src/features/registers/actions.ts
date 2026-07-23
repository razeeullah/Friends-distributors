"use server";
import { revalidatePath } from "next/cache";
import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import {
  RegisterPolicyError,
  closeRegister,
  openRegister,
  recordCashMovement,
} from "@/features/registers/services";
import {
  cashMovementSchema,
  closeRegisterSchema,
  openRegisterSchema,
  type CashMovementInput,
  type CloseRegisterInput,
  type OpenRegisterInput,
} from "@/features/registers/schemas";
type Result = { success: boolean; message: string };
const failed = (error: unknown): Result => ({
  success: false,
  message:
    error instanceof RegisterPolicyError
      ? error.message
      : "Register operation failed.",
});
export async function openRegisterAction(
  input: OpenRegisterInput,
): Promise<Result> {
  const parsed = openRegisterSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Enter a valid opening amount." };
  const context = await requirePermission("register.open");
  try {
    await openRegister(context, parsed.data, await getRequestMetadata());
    revalidatePath("/registers");
    return { success: true, message: "Register opened." };
  } catch (error) {
    return failed(error);
  }
}
export async function recordCashMovementAction(
  input: CashMovementInput,
): Promise<Result> {
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      message: "Enter a valid cash movement and reason.",
    };
  const context = await requirePermission("register.cash_movement");
  try {
    await recordCashMovement(context, parsed.data, await getRequestMetadata());
    revalidatePath("/registers");
    return { success: true, message: "Cash movement recorded." };
  } catch (error) {
    return failed(error);
  }
}
export async function closeRegisterAction(
  input: CloseRegisterInput,
): Promise<Result> {
  const parsed = closeRegisterSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Enter a valid counted cash amount." };
  const context = await requirePermission("register.close");
  try {
    await closeRegister(context, parsed.data, await getRequestMetadata());
    revalidatePath("/registers");
    return { success: true, message: "Register closed." };
  } catch (error) {
    return failed(error);
  }
}
