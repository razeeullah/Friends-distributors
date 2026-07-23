// This module imports a Node built-in deliberately: it is a transaction-only
// server boundary and must never be imported by a Client Component.
import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import {
  StockMovementType,
  StockReferenceType,
} from "@/generated/prisma/enums";
import { InventoryPolicyError } from "@/features/inventory/policy";

export interface InventoryScope {
  businessId: string;
  locationId: string;
  productVariantId: string;
}

export interface InventoryMutation extends InventoryScope {
  quantity: Prisma.Decimal;
  unitCost?: Prisma.Decimal | null;
  movementType: StockMovementType;
  referenceType: StockReferenceType;
  referenceId: string;
  referenceLineId?: string | null;
  notes?: string | null;
  performedById: string;
}

function zero(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

export async function getInventoryBalance(
  transaction: Prisma.TransactionClient,
  scope: InventoryScope,
) {
  const key: InventoryScope = {
    businessId: scope.businessId,
    locationId: scope.locationId,
    productVariantId: scope.productVariantId,
  };
  await transaction.$executeRaw`
    INSERT INTO inventory_balances (
      id, "businessId", "locationId", "productVariantId", quantity, "averageUnitCost", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}::uuid,
      ${key.businessId}::uuid,
      ${key.locationId}::uuid,
      ${key.productVariantId}::uuid,
      0,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT ("businessId", "locationId", "productVariantId") DO NOTHING
  `;
  await transaction.$queryRaw`
    SELECT id FROM inventory_balances
    WHERE "businessId" = ${scope.businessId}::uuid
      AND "locationId" = ${scope.locationId}::uuid
      AND "productVariantId" = ${scope.productVariantId}::uuid
    FOR UPDATE
  `;
  return transaction.inventoryBalance.findUniqueOrThrow({
    where: { businessId_locationId_productVariantId: key },
    select: { id: true, quantity: true, averageUnitCost: true },
  });
}

export function assertAvailableStock(
  quantityAfter: Prisma.Decimal,
  allowNegativeStock: boolean,
): void {
  if (quantityAfter.lessThan(0) && !allowNegativeStock) {
    throw new InventoryPolicyError(
      "NEGATIVE_STOCK",
      "This adjustment would create negative stock, which this product does not permit.",
    );
  }
}

export async function createStockMovement(
  transaction: Prisma.TransactionClient,
  input: InventoryMutation & {
    quantityBefore: Prisma.Decimal;
    quantityAfter: Prisma.Decimal;
  },
): Promise<string> {
  if (input.quantity.isZero()) {
    throw new InventoryPolicyError(
      "INVALID_ADJUSTMENT",
      "Stock movement quantity cannot be zero.",
    );
  }
  const movement = await transaction.stockMovement.create({
    data: {
      businessId: input.businessId,
      locationId: input.locationId,
      productVariantId: input.productVariantId,
      movementType: input.movementType,
      quantityChange: input.quantity,
      quantityBefore: input.quantityBefore,
      quantityAfter: input.quantityAfter,
      unitCost: input.unitCost ?? null,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      referenceLineId: input.referenceLineId ?? null,
      notes: input.notes ?? null,
      performedById: input.performedById,
    },
    select: { id: true },
  });
  return movement.id;
}

async function variantInventoryPolicy(
  transaction: Prisma.TransactionClient,
  businessId: string,
  productVariantId: string,
) {
  const variant = await transaction.productVariant.findFirst({
    where: {
      id: productVariantId,
      businessId,
      isActive: true,
      archivedAt: null,
      product: { isActive: true, archivedAt: null },
    },
    select: { product: { select: { allowNegativeStock: true } } },
  });
  if (variant === null) {
    throw new InventoryPolicyError("NOT_FOUND", "Product variant not found.");
  }
  return variant;
}

export async function increaseStock(
  transaction: Prisma.TransactionClient,
  input: InventoryMutation,
) {
  if (!input.quantity.greaterThan(0)) {
    throw new InventoryPolicyError(
      "INVALID_ADJUSTMENT",
      "Stock increase quantity must be greater than zero.",
    );
  }
  await variantInventoryPolicy(
    transaction,
    input.businessId,
    input.productVariantId,
  );
  const balance = await getInventoryBalance(transaction, input);
  const quantityAfter = balance.quantity.add(input.quantity);
  const unitCost = input.unitCost ?? balance.averageUnitCost;
  const averageUnitCost = quantityAfter.isZero()
    ? (unitCost ?? zero())
    : balance.quantity
        .mul(balance.averageUnitCost)
        .add(input.quantity.mul(unitCost ?? zero()))
        .div(quantityAfter)
        .toDecimalPlaces(2);
  await transaction.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantity: quantityAfter, averageUnitCost },
  });
  await createStockMovement(transaction, {
    ...input,
    unitCost,
    quantityBefore: balance.quantity,
    quantityAfter,
  });
  return { quantityBefore: balance.quantity, quantityAfter, averageUnitCost };
}

export async function decreaseStock(
  transaction: Prisma.TransactionClient,
  input: InventoryMutation,
) {
  if (!input.quantity.lessThan(0)) {
    throw new InventoryPolicyError(
      "INVALID_ADJUSTMENT",
      "Stock decrease quantity must be less than zero.",
    );
  }
  const variant = await variantInventoryPolicy(
    transaction,
    input.businessId,
    input.productVariantId,
  );
  const balance = await getInventoryBalance(transaction, input);
  const quantityAfter = balance.quantity.add(input.quantity);
  assertAvailableStock(quantityAfter, variant.product.allowNegativeStock);
  await transaction.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantity: quantityAfter },
  });
  await createStockMovement(transaction, {
    ...input,
    unitCost: input.unitCost ?? balance.averageUnitCost,
    quantityBefore: balance.quantity,
    quantityAfter,
  });
  return {
    quantityBefore: balance.quantity,
    quantityAfter,
    unitCost: input.unitCost ?? balance.averageUnitCost,
  };
}

export async function setStockByAdjustment(
  transaction: Prisma.TransactionClient,
  input: Omit<InventoryMutation, "quantity" | "movementType" | "unitCost"> & {
    countedQuantity: Prisma.Decimal;
    expectedDirection: "INCREASE" | "DECREASE";
  },
) {
  const balance = await getInventoryBalance(transaction, input);
  const quantityChange = input.countedQuantity.sub(balance.quantity);
  if (quantityChange.isZero()) {
    throw new InventoryPolicyError(
      "INVALID_ADJUSTMENT",
      "Counted quantity matches current stock; no adjustment is required.",
    );
  }
  const direction = quantityChange.greaterThan(0) ? "INCREASE" : "DECREASE";
  if (direction !== input.expectedDirection) {
    throw new InventoryPolicyError(
      "INVALID_ADJUSTMENT",
      "The latest system quantity no longer matches the selected adjustment direction. Review the count and create a new draft.",
    );
  }
  const variant = await variantInventoryPolicy(
    transaction,
    input.businessId,
    input.productVariantId,
  );
  assertAvailableStock(
    input.countedQuantity,
    variant.product.allowNegativeStock,
  );
  await transaction.inventoryBalance.update({
    where: { id: balance.id },
    data: { quantity: input.countedQuantity },
  });
  await createStockMovement(transaction, {
    ...input,
    quantity: quantityChange,
    unitCost: balance.averageUnitCost,
    movementType:
      direction === "INCREASE"
        ? StockMovementType.ADJUSTMENT_IN
        : StockMovementType.ADJUSTMENT_OUT,
    quantityBefore: balance.quantity,
    quantityAfter: input.countedQuantity,
  });
  return {
    systemQuantity: balance.quantity,
    countedQuantity: input.countedQuantity,
    quantityChange,
    unitCost: balance.averageUnitCost,
  };
}
