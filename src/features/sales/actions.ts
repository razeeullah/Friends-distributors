"use server";

import { revalidatePath } from "next/cache";

import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import { SalePolicyError } from "@/features/sales/policy";
import {
  checkoutSaleSchema,
  holdSaleSchema,
  quickCustomerSchema,
  saleReturnSchema,
  voidSaleSchema,
  type CheckoutSaleInput,
  type HoldSaleInput,
  type QuickCustomerInput,
  type SaleActionResult,
  type SaleReturnInput,
  type VoidSaleInput,
} from "@/features/sales/schemas";
import {
  checkoutSale,
  holdSale,
  quickCreateCustomer,
  createSaleReturn,
  voidSale,
} from "@/features/sales/services";
import { InventoryPolicyError } from "@/features/inventory/policy";

function invalid(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): SaleActionResult {
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
function failure(error: unknown): SaleActionResult {
  if (error instanceof SalePolicyError || error instanceof InventoryPolicyError)
    return { success: false, message: error.message };
  return {
    success: false,
    message: "The checkout could not be completed. No sale was recorded.",
  };
}
export async function checkoutSaleAction(
  input: CheckoutSaleInput,
): Promise<SaleActionResult> {
  const parsed = checkoutSaleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const context = await requirePermission("sale.create");
  try {
    const sale = await checkoutSale(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/pos");
    revalidatePath("/inventory");
    return {
      success: true,
      message: `Sale ${sale.receiptNumber} completed.`,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function holdSaleAction(
  input: HoldSaleInput,
): Promise<SaleActionResult> {
  const parsed = holdSaleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const context = await requirePermission("sale.create");
  try {
    const sale = await holdSale(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/pos");
    return {
      success: true,
      message: `Sale ${sale.receiptNumber} held.`,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
    };
  } catch (error) {
    return failure(error);
  }
}
export async function quickCreateCustomerAction(
  input: QuickCustomerInput,
): Promise<{
  success: boolean;
  message: string;
  customer?: { id: string; name: string; phone: string | null };
}> {
  const parsed = quickCustomerSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      message: "Enter a valid customer name and email.",
    };
  const context = await requirePermission("customer.create");
  try {
    const customer = await quickCreateCustomer(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/pos");
    return { success: true, message: "Customer added.", customer };
  } catch (error) {
    return { success: false, message: failure(error).message };
  }
}

export async function createSaleReturnAction(
  input: SaleReturnInput,
): Promise<SaleActionResult> {
  const parsed = saleReturnSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const context = await requirePermission("sale.refund");
  try {
    const result = await createSaleReturn(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/sales");
    revalidatePath(`/sales/${input.saleId}`);
    return {
      success: true,
      message: `Return ${result.returnNumber} completed.`,
      saleId: result.id,
      receiptNumber: result.returnNumber,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function voidSaleAction(
  input: VoidSaleInput,
): Promise<SaleActionResult> {
  const parsed = voidSaleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const context = await requirePermission("sale.void");
  try {
    const result = await voidSale(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/sales");
    revalidatePath(`/sales/${result.id}`);
    return {
      success: true,
      message: `Sale ${result.receiptNumber} voided.`,
      saleId: result.id,
    };
  } catch (error) {
    return failure(error);
  }
}
