"use server";
import { revalidatePath } from "next/cache";
import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import {
  expenseCategorySchema,
  expenseSchema,
  expenseStatusSchema,
  type ExpenseCategoryInput,
  type ExpenseInput,
  type ExpenseStatusInput,
} from "@/features/expenses/schemas";
import {
  ExpensePolicyError,
  saveExpense,
  saveExpenseCategory,
  transitionExpense,
} from "@/features/expenses/services";
const result = (error: unknown) => ({
  success: false,
  message:
    error instanceof ExpensePolicyError
      ? error.message
      : "Expense request failed.",
});
export async function saveExpenseAction(input: ExpenseInput) {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Check the expense details." };
  const context = await requirePermission("expense.create");
  try {
    await saveExpense(context, parsed.data, await getRequestMetadata());
    revalidatePath("/expenses");
    return { success: true, message: "Expense saved as draft." };
  } catch (error) {
    return result(error);
  }
}
export async function transitionExpenseAction(input: ExpenseStatusInput) {
  const parsed = expenseStatusSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Check the status transition." };
  const permission =
    parsed.data.action === "APPROVE" || parsed.data.action === "REJECT"
      ? "expense.approve"
      : "expense.create";
  const context = await requirePermission(permission);
  try {
    await transitionExpense(context, parsed.data, await getRequestMetadata());
    revalidatePath("/expenses");
    return {
      success: true,
      message: `Expense ${parsed.data.action.toLowerCase()}ed.`,
    };
  } catch (error) {
    return result(error);
  }
}
export async function saveExpenseCategoryAction(input: ExpenseCategoryInput) {
  const parsed = expenseCategorySchema.safeParse(input);
  if (!parsed.success)
    return { success: false, message: "Check the category." };
  const context = await requirePermission("expense.create");
  try {
    await saveExpenseCategory(context, parsed.data);
    revalidatePath("/expenses");
    return { success: true, message: "Category saved." };
  } catch (error) {
    return result(error);
  }
}
