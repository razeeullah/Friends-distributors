// This service owns database transactions and is server-only.
import "node:crypto";

import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import {
  assertAdjustmentDraft,
  assertInventoryPermission,
  InventoryPolicyError,
} from "@/features/inventory/policy";
import { setStockByAdjustment } from "@/features/inventory/service";
import type { StockAdjustmentInput } from "@/features/inventory/schemas";
import { Prisma } from "@/generated/prisma/client";
import {
  AdjustmentType,
  AuditAction,
  StockAdjustmentStatus,
  StockReferenceType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function assertLocation(
  transaction: Prisma.TransactionClient,
  context: AuthContext,
  locationId: string,
): Promise<void> {
  if (!context.locations.some(({ id }) => id === locationId)) {
    throw new InventoryPolicyError(
      "FORBIDDEN",
      "You do not have access to the selected location.",
    );
  }
  const location = await transaction.location.findFirst({
    where: {
      id: locationId,
      businessId: context.business.id,
      isActive: true,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (location === null) {
    throw new InventoryPolicyError("NOT_FOUND", "Location not found.");
  }
}

async function nextAdjustmentNumber(
  transaction: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
): Promise<string> {
  const sequence = await transaction.numberSequence.upsert({
    where: {
      businessId_locationId_key: {
        businessId,
        locationId,
        key: "STOCK_ADJUSTMENT",
      },
    },
    update: { nextValue: { increment: 1 } },
    create: {
      businessId,
      locationId,
      key: "STOCK_ADJUSTMENT",
      prefix: "ADJ-",
      nextValue: 2,
      padding: 6,
    },
    select: { prefix: true, nextValue: true, padding: true },
  });
  const issued = sequence.nextValue - 1n;
  return `${sequence.prefix}${issued.toString().padStart(sequence.padding, "0")}`;
}

export async function createStockAdjustment(
  context: AuthContext,
  input: StockAdjustmentInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertInventoryPermission(context.permissions, "inventory.adjust");
  return db.$transaction(async (transaction) => {
    await assertLocation(transaction, context, input.locationId);
    const variants = await transaction.productVariant.findMany({
      where: {
        id: { in: input.items.map(({ productVariantId }) => productVariantId) },
        businessId: context.business.id,
        isActive: true,
        archivedAt: null,
        product: { isActive: true, archivedAt: null },
      },
      select: { id: true },
    });
    if (variants.length !== input.items.length) {
      throw new InventoryPolicyError(
        "NOT_FOUND",
        "One or more product variants are unavailable.",
      );
    }
    const balances = await transaction.inventoryBalance.findMany({
      where: {
        businessId: context.business.id,
        locationId: input.locationId,
        productVariantId: {
          in: input.items.map(({ productVariantId }) => productVariantId),
        },
      },
      select: { productVariantId: true, quantity: true, averageUnitCost: true },
    });
    const balanceByVariant = new Map(
      balances.map((balance) => [balance.productVariantId, balance]),
    );
    const items = input.items.map((item) => {
      const balance = balanceByVariant.get(item.productVariantId);
      const systemQuantity = balance?.quantity ?? new Prisma.Decimal(0);
      const countedQuantity = decimal(item.countedQuantity);
      const quantityChange = countedQuantity.sub(systemQuantity);
      const direction = quantityChange.greaterThan(0) ? "INCREASE" : "DECREASE";
      if (quantityChange.isZero() || direction !== input.adjustmentType) {
        throw new InventoryPolicyError(
          "INVALID_ADJUSTMENT",
          "Every counted quantity must create a non-zero difference in the selected direction.",
        );
      }
      return {
        productVariantId: item.productVariantId,
        systemQuantity,
        countedQuantity,
        quantityChange,
        unitCost: balance?.averageUnitCost ?? new Prisma.Decimal(0),
      };
    });
    const adjustment = await transaction.stockAdjustment.create({
      data: {
        businessId: context.business.id,
        locationId: input.locationId,
        adjustmentNumber: await nextAdjustmentNumber(
          transaction,
          context.business.id,
          input.locationId,
        ),
        adjustmentType:
          input.adjustmentType === "INCREASE"
            ? AdjustmentType.INCREASE
            : AdjustmentType.DECREASE,
        reason: input.reason,
        notes: nullable(input.notes),
        createdById: context.user.id,
        items: { create: items },
      },
      select: { id: true, adjustmentNumber: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: input.locationId,
      actorUserId: context.user.id,
      action: AuditAction.CREATE,
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      after: {
        adjustmentNumber: adjustment.adjustmentNumber,
        adjustmentType: input.adjustmentType,
        itemCount: items.length,
        reason: input.reason,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return adjustment.id;
  });
}

export async function postStockAdjustment(
  context: AuthContext,
  adjustmentId: string,
  metadata: RequestMetadata,
): Promise<void> {
  assertInventoryPermission(context.permissions, "inventory.adjust");
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM stock_adjustments
      WHERE id = ${adjustmentId}::uuid
      FOR UPDATE
    `;
    const adjustment = await transaction.stockAdjustment.findFirst({
      where: { id: adjustmentId, businessId: context.business.id },
      select: {
        id: true,
        adjustmentNumber: true,
        locationId: true,
        adjustmentType: true,
        status: true,
        reason: true,
        notes: true,
        items: {
          select: {
            id: true,
            productVariantId: true,
            countedQuantity: true,
          },
        },
      },
    });
    if (adjustment === null) {
      throw new InventoryPolicyError(
        "NOT_FOUND",
        "Stock adjustment not found.",
      );
    }
    assertAdjustmentDraft(adjustment.status);
    await assertLocation(transaction, context, adjustment.locationId);
    const expectedDirection =
      adjustment.adjustmentType === AdjustmentType.INCREASE
        ? "INCREASE"
        : "DECREASE";
    const postedItems: Array<{
      id: string;
      systemQuantity: string;
      countedQuantity: string;
      quantityChange: string;
    }> = [];
    for (const item of adjustment.items) {
      const posted = await setStockByAdjustment(transaction, {
        businessId: context.business.id,
        locationId: adjustment.locationId,
        productVariantId: item.productVariantId,
        countedQuantity: item.countedQuantity,
        expectedDirection,
        referenceType: StockReferenceType.STOCK_ADJUSTMENT,
        referenceId: adjustment.id,
        referenceLineId: item.id,
        notes: `${adjustment.adjustmentNumber}: ${adjustment.reason}${
          adjustment.notes ? ` — ${adjustment.notes}` : ""
        }`,
        performedById: context.user.id,
      });
      await transaction.stockAdjustmentItem.update({
        where: { id: item.id },
        data: {
          systemQuantity: posted.systemQuantity,
          countedQuantity: posted.countedQuantity,
          quantityChange: posted.quantityChange,
          unitCost: posted.unitCost,
        },
      });
      postedItems.push({
        id: item.id,
        systemQuantity: posted.systemQuantity.toString(),
        countedQuantity: posted.countedQuantity.toString(),
        quantityChange: posted.quantityChange.toString(),
      });
    }
    const completedAt = new Date();
    await transaction.stockAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: StockAdjustmentStatus.COMPLETED,
        completedById: context.user.id,
        completedAt,
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: adjustment.locationId,
      actorUserId: context.user.id,
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      before: { status: adjustment.status },
      after: {
        status: StockAdjustmentStatus.COMPLETED,
        completedAt: completedAt.toISOString(),
        items: postedItems,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}
