import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import type {
  ExpenseCategoryInput,
  ExpenseInput,
  ExpenseStatusInput,
} from "@/features/expenses/schemas";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  CashMovementType,
  ExpenseStatus,
  PaymentMethod,
  RegisterSessionStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
const dec = (value: string) => new Prisma.Decimal(value).toDecimalPlaces(2);
export class ExpensePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpensePolicyError";
  }
}
async function number(
  transaction: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
) {
  const sequence = await transaction.numberSequence.upsert({
    where: {
      businessId_locationId_key: { businessId, locationId, key: "EXPENSE" },
    },
    update: { nextValue: { increment: 1 } },
    create: {
      businessId,
      locationId,
      key: "EXPENSE",
      prefix: "EXP-",
      nextValue: 2,
      padding: 6,
    },
    select: { prefix: true, nextValue: true, padding: true },
  });
  return `${sequence.prefix}${(sequence.nextValue - 1n).toString().padStart(sequence.padding, "0")}`;
}
export async function saveExpense(
  context: AuthContext,
  input: ExpenseInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("expense.create"))
    throw new ExpensePolicyError("Missing expense.create permission.");
  if (!context.locations.some((location) => location.id === input.locationId))
    throw new ExpensePolicyError("Location access denied.");
  return db.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.expense.findFirst({
        where: { id: input.id, businessId: context.business.id },
        select: { id: true, status: true },
      });
      if (!existing || existing.status !== ExpenseStatus.DRAFT)
        throw new ExpensePolicyError("Only draft expenses can be edited.");
      await tx.expense.update({
        where: { id: existing.id },
        data: {
          expenseCategoryId: input.expenseCategoryId,
          locationId: input.locationId,
          expenseDate: new Date(`${input.expenseDate}T00:00:00+05:00`),
          vendorName: input.vendorName?.trim() || null,
          description: input.description,
          amount: dec(input.amount),
          tax: dec(input.tax),
          total: dec(input.amount).add(dec(input.tax)),
          receiptReference: input.receiptReference?.trim() || null,
        },
      });
      return existing.id;
    }
    const category = await tx.expenseCategory.findFirst({
      where: {
        id: input.expenseCategoryId,
        businessId: context.business.id,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!category) throw new ExpensePolicyError("Expense category not found.");
    const expense = await tx.expense.create({
      data: {
        businessId: context.business.id,
        locationId: input.locationId,
        expenseCategoryId: category.id,
        expenseNumber: await number(tx, context.business.id, input.locationId),
        status: ExpenseStatus.DRAFT,
        expenseDate: new Date(`${input.expenseDate}T00:00:00+05:00`),
        vendorName: input.vendorName?.trim() || null,
        description: input.description,
        amount: dec(input.amount),
        tax: dec(input.tax),
        total: dec(input.amount).add(dec(input.tax)),
        receiptReference: input.receiptReference?.trim() || null,
        createdById: context.user.id,
      },
      select: { id: true },
    });
    await writeAuditLog(tx, {
      businessId: context.business.id,
      locationId: input.locationId,
      actorUserId: context.user.id,
      action: AuditAction.EXPENSE_CREATED,
      entityType: "Expense",
      entityId: expense.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return expense.id;
  });
}
export async function transitionExpense(
  context: AuthContext,
  input: ExpenseStatusInput,
  metadata: RequestMetadata,
) {
  if (
    !context.permissions.has(
      input.action === "SUBMIT"
        ? "expense.create"
        : input.action === "APPROVE" || input.action === "REJECT"
          ? "expense.approve"
          : "expense.create",
    )
  )
    throw new ExpensePolicyError("Missing expense permission.");
  return db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: input.expenseId, businessId: context.business.id },
      select: { id: true, status: true, total: true, locationId: true },
    });
    if (!expense) throw new ExpensePolicyError("Expense not found.");
    let status: ExpenseStatus;
    let action: AuditAction;
    const data: Prisma.ExpenseUpdateInput = {};
    if (input.action === "SUBMIT") {
      if (expense.status !== ExpenseStatus.DRAFT)
        throw new ExpensePolicyError("Only drafts can be submitted.");
      status = ExpenseStatus.PENDING_APPROVAL;
      action = AuditAction.EXPENSE_SUBMITTED;
    } else if (input.action === "APPROVE") {
      if (
        expense.status !== ExpenseStatus.PENDING &&
        expense.status !== ExpenseStatus.PENDING_APPROVAL
      )
        throw new ExpensePolicyError(
          "Only submitted expenses can be approved.",
        );
      status = ExpenseStatus.APPROVED;
      action = AuditAction.EXPENSE_APPROVED;
      data.approvedBy = { connect: { id: context.user.id } };
      data.approvedAt = new Date();
    } else if (input.action === "REJECT") {
      if (
        expense.status !== ExpenseStatus.PENDING &&
        expense.status !== ExpenseStatus.PENDING_APPROVAL
      )
        throw new ExpensePolicyError(
          "Only submitted expenses can be rejected.",
        );
      if (!input.reason)
        throw new ExpensePolicyError("A rejection reason is required.");
      status = ExpenseStatus.REJECTED;
      action = AuditAction.EXPENSE_REJECTED;
    } else if (input.action === "PAY") {
      if (expense.status !== ExpenseStatus.APPROVED || !input.paymentMethod)
        throw new ExpensePolicyError(
          "Only approved expenses with a payment method can be paid.",
        );
      status = ExpenseStatus.PAID;
      action = AuditAction.EXPENSE_PAID;
      data.paymentMethod = input.paymentMethod as PaymentMethod;
      data.paidAt = new Date();
      data.paidBy = { connect: { id: context.user.id } };
      if (input.paymentMethod === "CASH") {
        const session = await tx.registerSession.findFirst({
          where: {
            businessId: context.business.id,
            locationId: expense.locationId,
            status: RegisterSessionStatus.OPEN,
          },
          select: { id: true },
        });
        if (!session)
          throw new ExpensePolicyError(
            "An open register session is required for cash expenses.",
          );
        data.registerSession = { connect: { id: session.id } };
        await tx.cashMovement.create({
          data: {
            businessId: context.business.id,
            locationId: expense.locationId,
            registerSessionId: session.id,
            movementType: CashMovementType.EXPENSE,
            amount: expense.total.negated(),
            referenceType: "EXPENSE",
            referenceId: expense.id,
            notes: input.reason || "Cash expense payment",
            createdById: context.user.id,
          },
        });
      }
    } else {
      if (
        (expense.status !== ExpenseStatus.DRAFT &&
          expense.status !== ExpenseStatus.PENDING &&
          expense.status !== ExpenseStatus.PENDING_APPROVAL &&
          expense.status !== ExpenseStatus.APPROVED) ||
        !input.reason
      )
        throw new ExpensePolicyError(
          "Only unpaid expenses with a void reason can be voided.",
        );
      status = ExpenseStatus.VOIDED;
      action = AuditAction.EXPENSE_VOIDED;
      data.voidedAt = new Date();
      data.voidedBy = { connect: { id: context.user.id } };
      data.voidReason = input.reason;
    }
    data.status = status;
    await tx.expense.update({ where: { id: expense.id }, data });
    await writeAuditLog(tx, {
      businessId: context.business.id,
      locationId: expense.locationId,
      actorUserId: context.user.id,
      action,
      entityType: "Expense",
      entityId: expense.id,
      metadata: { status, reason: input.reason ?? null },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return expense.id;
  });
}
export async function saveExpenseCategory(
  context: AuthContext,
  input: ExpenseCategoryInput,
) {
  if (!context.permissions.has("expense.create"))
    throw new ExpensePolicyError("Missing expense.create permission.");
  return db.expenseCategory.upsert({
    where: {
      businessId_code: { businessId: context.business.id, code: input.code },
    },
    update: {
      name: input.name,
      description: input.description?.trim() || null,
      isActive: true,
    },
    create: {
      businessId: context.business.id,
      code: input.code,
      name: input.name,
      description: input.description?.trim() || null,
    },
  });
}
