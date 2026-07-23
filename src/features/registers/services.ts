import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import type {
  CashMovementInput,
  CloseRegisterInput,
  OpenRegisterInput,
} from "@/features/registers/schemas";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  CashMovementType,
  RegisterSessionStatus,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";
const zero = new Prisma.Decimal(0);
const decimal = (value: string) => new Prisma.Decimal(value).toDecimalPlaces(2);
export class RegisterPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegisterPolicyError";
  }
}
export async function expectedCash(
  transaction: Prisma.TransactionClient,
  sessionId: string,
): Promise<Prisma.Decimal> {
  const session = await transaction.registerSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { openingCash: true },
  });
  const movements = await transaction.cashMovement.aggregate({
    where: { registerSessionId: sessionId },
    _sum: { amount: true },
  });
  return session.openingCash
    .add(movements._sum.amount ?? zero)
    .toDecimalPlaces(2);
}
export async function openRegister(
  context: AuthContext,
  input: OpenRegisterInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("register.open"))
    throw new RegisterPolicyError("Missing register.open permission.");
  const locationId = context.currentLocation?.id;
  if (!locationId) throw new RegisterPolicyError("Select a location first.");
  return db.$transaction(async (transaction) => {
    const register = await transaction.register.findFirst({
      where: {
        id: input.registerId,
        businessId: context.business.id,
        locationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!register) throw new RegisterPolicyError("Register not found.");
    const active = await transaction.registerSession.findFirst({
      where: { registerId: register.id, status: RegisterSessionStatus.OPEN },
      select: { id: true },
    });
    if (active)
      throw new RegisterPolicyError(
        "This register already has an active session.",
      );
    const session = await transaction.registerSession.create({
      data: {
        businessId: context.business.id,
        locationId,
        registerId: register.id,
        openingCash: decimal(input.openingCash),
        notes: input.notes?.trim() || null,
        openedById: context.user.id,
      },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId,
      actorUserId: context.user.id,
      action: AuditAction.REGISTER_OPENED,
      entityType: "RegisterSession",
      entityId: session.id,
      after: { openingCash: input.openingCash },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return session;
  });
}
export async function recordCashMovement(
  context: AuthContext,
  input: CashMovementInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("register.cash_movement"))
    throw new RegisterPolicyError("Missing register.cash_movement permission.");
  return db.$transaction(async (transaction) => {
    const session = await transaction.registerSession.findFirst({
      where: {
        id: input.registerSessionId,
        businessId: context.business.id,
        status: RegisterSessionStatus.OPEN,
        locationId: { in: context.locations.map((location) => location.id) },
      },
      select: { id: true, locationId: true },
    });
    if (!session)
      throw new RegisterPolicyError("Active register session not found.");
    const signedAmount =
      input.type === "CASH_IN"
        ? decimal(input.amount)
        : decimal(input.amount).negated();
    const movement = await transaction.cashMovement.create({
      data: {
        businessId: context.business.id,
        locationId: session.locationId,
        registerSessionId: session.id,
        movementType:
          input.type === "CASH_IN"
            ? CashMovementType.CASH_IN
            : CashMovementType.CASH_OUT,
        amount: signedAmount,
        notes: input.reason,
        createdById: context.user.id,
      },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: session.locationId,
      actorUserId: context.user.id,
      action:
        input.type === "CASH_IN"
          ? AuditAction.REGISTER_CASH_ADDED
          : AuditAction.REGISTER_CASH_REMOVED,
      entityType: "CashMovement",
      entityId: movement.id,
      after: { amount: signedAmount.toString(), reason: input.reason },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return movement;
  });
}
export async function closeRegister(
  context: AuthContext,
  input: CloseRegisterInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("register.close"))
    throw new RegisterPolicyError("Missing register.close permission.");
  return db.$transaction(async (transaction) => {
    const session = await transaction.registerSession.findFirst({
      where: {
        id: input.registerSessionId,
        businessId: context.business.id,
        status: RegisterSessionStatus.OPEN,
        locationId: { in: context.locations.map((location) => location.id) },
      },
      select: { id: true, locationId: true },
    });
    if (!session)
      throw new RegisterPolicyError("Active register session not found.");
    const expected = await expectedCash(transaction, session.id);
    const counted = decimal(input.countedCash);
    const difference = counted.sub(expected);
    await transaction.registerSession.update({
      where: { id: session.id },
      data: {
        status: RegisterSessionStatus.CLOSED,
        expectedCash: expected,
        closingCash: counted,
        cashDifference: difference,
        notes: input.notes?.trim() || null,
        closedById: context.user.id,
        closedAt: new Date(),
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: session.locationId,
      actorUserId: context.user.id,
      action: AuditAction.REGISTER_CLOSED,
      entityType: "RegisterSession",
      entityId: session.id,
      after: {
        expected: expected.toString(),
        counted: counted.toString(),
        difference: difference.toString(),
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    if (!difference.isZero())
      await writeAuditLog(transaction, {
        businessId: context.business.id,
        locationId: session.locationId,
        actorUserId: context.user.id,
        action: AuditAction.REGISTER_DIFFERENCE_RECORDED,
        entityType: "RegisterSession",
        entityId: session.id,
        metadata: { difference: difference.toString() },
      });
    return { expected, counted, difference };
  });
}
