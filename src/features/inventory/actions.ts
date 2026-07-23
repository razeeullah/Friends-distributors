"use server";

import { revalidatePath } from "next/cache";

import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import { InventoryPolicyError } from "@/features/inventory/policy";
import {
  type InventoryActionResult,
  stockAdjustmentIdSchema,
  stockAdjustmentSchema,
  type StockAdjustmentInput,
} from "@/features/inventory/schemas";
import {
  createStockAdjustment,
  postStockAdjustment,
} from "@/features/inventory/services";
import { Prisma } from "@/generated/prisma/client";

function validationFailure(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): InventoryActionResult {
  return {
    success: false,
    message: "Check the highlighted fields and try again.",
    fieldErrors: Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined,
      ),
    ),
  };
}

function requestFailure(error: unknown): InventoryActionResult {
  if (error instanceof InventoryPolicyError) {
    return { success: false, message: error.message };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      success: false,
      message: "That adjustment number or item already exists.",
    };
  }
  return {
    success: false,
    message: "The inventory request could not be completed.",
  };
}

export async function createStockAdjustmentAction(
  input: StockAdjustmentInput,
): Promise<InventoryActionResult> {
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("inventory.adjust");
  try {
    const adjustmentId = await createStockAdjustment(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/inventory");
    revalidatePath("/inventory/adjustments");
    return {
      success: true,
      message: "Draft adjustment created.",
      redirectTo: `/inventory/adjustments/${adjustmentId}`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function postStockAdjustmentAction(input: {
  adjustmentId: string;
}): Promise<InventoryActionResult> {
  const parsed = stockAdjustmentIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("inventory.adjust");
  try {
    await postStockAdjustment(
      context,
      parsed.data.adjustmentId,
      await getRequestMetadata(),
    );
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/valuation");
    revalidatePath(`/inventory/adjustments/${parsed.data.adjustmentId}`);
    return { success: true, message: "Stock adjustment posted." };
  } catch (error) {
    return requestFailure(error);
  }
}
