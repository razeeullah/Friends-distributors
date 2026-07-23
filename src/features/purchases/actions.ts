"use server";

import { revalidatePath } from "next/cache";

import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import { PurchasePolicyError } from "@/features/purchases/policy";
import {
  createPurchaseSchema,
  type CreatePurchaseInput,
  type PurchaseActionResult,
  purchaseIdSchema,
  purchasePaymentSchema,
  type PurchasePaymentInput,
  receivePurchaseSchema,
  type ReceivePurchaseInput,
  supplierSchema,
  type SupplierInput,
  updatePurchaseSchema,
  type UpdatePurchaseInput,
} from "@/features/purchases/schemas";
import {
  cancelPurchase,
  createPurchase,
  markPurchaseOrdered,
  receivePurchase,
  recordPurchasePayment,
  saveSupplier,
  updatePurchase,
} from "@/features/purchases/services";
import { Prisma } from "@/generated/prisma/client";

function validationFailure(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): PurchaseActionResult {
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

function requestFailure(error: unknown): PurchaseActionResult {
  if (error instanceof PurchasePolicyError) {
    return { success: false, message: error.message };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      success: false,
      message:
        "That supplier code, purchase number, or invoice already exists.",
    };
  }
  return {
    success: false,
    message: "The purchase request could not be completed.",
  };
}

export async function saveSupplierAction(
  input: SupplierInput,
): Promise<PurchaseActionResult> {
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("supplier.manage");
  try {
    const supplierId = await saveSupplier(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${supplierId}`);
    return {
      success: true,
      message: parsed.data.id ? "Supplier updated." : "Supplier created.",
      redirectTo: `/suppliers/${supplierId}`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function createPurchaseAction(
  input: CreatePurchaseInput,
): Promise<PurchaseActionResult> {
  const parsed = createPurchaseSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.create");
  try {
    const purchaseId = await createPurchase(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/purchases");
    return {
      success: true,
      message: "Draft purchase created.",
      redirectTo: `/purchases/${purchaseId}`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function updatePurchaseAction(
  input: UpdatePurchaseInput,
): Promise<PurchaseActionResult> {
  const parsed = updatePurchaseSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.create");
  try {
    await updatePurchase(context, parsed.data, await getRequestMetadata());
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${parsed.data.purchaseId}`);
    return {
      success: true,
      message: "Draft purchase updated.",
      redirectTo: `/purchases/${parsed.data.purchaseId}`,
    };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function markPurchaseOrderedAction(input: {
  purchaseId: string;
}): Promise<PurchaseActionResult> {
  const parsed = purchaseIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.create");
  try {
    await markPurchaseOrdered(
      context,
      parsed.data.purchaseId,
      await getRequestMetadata(),
    );
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${parsed.data.purchaseId}`);
    return { success: true, message: "Purchase marked as ordered." };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function receivePurchaseAction(
  input: ReceivePurchaseInput,
): Promise<PurchaseActionResult> {
  const parsed = receivePurchaseSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.receive");
  try {
    await receivePurchase(context, parsed.data, await getRequestMetadata());
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${parsed.data.purchaseId}`);
    revalidatePath("/products");
    revalidatePath("/inventory");
    return { success: true, message: "Stock receipt recorded." };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function recordPurchasePaymentAction(
  input: PurchasePaymentInput,
): Promise<PurchaseActionResult> {
  const parsed = purchasePaymentSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.create");
  try {
    await recordPurchasePayment(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${parsed.data.purchaseId}`);
    revalidatePath("/suppliers");
    return { success: true, message: "Supplier payment recorded." };
  } catch (error) {
    return requestFailure(error);
  }
}

export async function cancelPurchaseAction(input: {
  purchaseId: string;
}): Promise<PurchaseActionResult> {
  const parsed = purchaseIdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("purchase.create");
  try {
    await cancelPurchase(
      context,
      parsed.data.purchaseId,
      await getRequestMetadata(),
    );
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${parsed.data.purchaseId}`);
    return { success: true, message: "Purchase cancelled." };
  } catch (error) {
    return requestFailure(error);
  }
}
