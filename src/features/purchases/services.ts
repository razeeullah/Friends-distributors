import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import {
  assertPurchaseCancellable,
  assertPurchaseEditable,
  assertPurchaseOrderable,
  assertPurchasePermission,
  assertPurchaseReceivable,
  PurchasePolicyError,
} from "@/features/purchases/policy";
import type {
  CreatePurchaseInput,
  PurchasePaymentInput,
  ReceivePurchaseInput,
  SupplierInput,
  UpdatePurchaseInput,
} from "@/features/purchases/schemas";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  PurchaseStatus,
  StockMovementType,
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

function purchaseDate(value: string): Date {
  return new Date(`${value}T00:00:00+05:00`);
}

function calculateLines(input: CreatePurchaseInput | UpdatePurchaseInput) {
  let subtotal = new Prisma.Decimal(0);
  let discount = new Prisma.Decimal(0);
  let tax = new Prisma.Decimal(0);
  const items = input.items.map((item) => {
    const quantity = decimal(item.quantity);
    const unitCost = decimal(item.unitCost);
    const lineSubtotal = quantity.mul(unitCost).toDecimalPlaces(2);
    const lineDiscount = decimal(item.discount);
    const lineTax = decimal(item.tax);
    if (lineDiscount.greaterThan(lineSubtotal)) {
      throw new PurchasePolicyError(
        "INVALID_TOTALS",
        "An item discount cannot exceed its subtotal.",
      );
    }
    const lineTotal = lineSubtotal.sub(lineDiscount).add(lineTax);
    subtotal = subtotal.add(lineSubtotal);
    discount = discount.add(lineDiscount);
    tax = tax.add(lineTax);
    return {
      productVariantId: item.productVariantId,
      quantity,
      unitCost,
      discount: lineDiscount,
      tax: lineTax,
      lineSubtotal,
      lineTotal,
    };
  });
  return {
    items,
    subtotal,
    discount,
    tax,
    total: subtotal.sub(discount).add(tax),
  };
}

async function assertLocation(
  transaction: Prisma.TransactionClient,
  context: AuthContext,
  locationId: string,
): Promise<void> {
  if (!context.locations.some(({ id }) => id === locationId)) {
    throw new PurchasePolicyError(
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
    throw new PurchasePolicyError("NOT_FOUND", "Location not found.");
  }
}

async function assertSupplierAndVariants(
  transaction: Prisma.TransactionClient,
  businessId: string,
  supplierId: string,
  variantIds: readonly string[],
): Promise<void> {
  const [supplier, variantCount] = await Promise.all([
    transaction.supplier.findFirst({
      where: {
        id: supplierId,
        businessId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    }),
    transaction.productVariant.count({
      where: {
        id: { in: [...variantIds] },
        businessId,
        isActive: true,
        archivedAt: null,
        product: { isActive: true, archivedAt: null },
      },
    }),
  ]);
  if (supplier === null) {
    throw new PurchasePolicyError("NOT_FOUND", "Supplier not found.");
  }
  if (variantCount !== variantIds.length) {
    throw new PurchasePolicyError(
      "NOT_FOUND",
      "One or more product variants are unavailable.",
    );
  }
}

async function nextPurchaseNumber(
  transaction: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
): Promise<string> {
  const sequence = await transaction.numberSequence.upsert({
    where: {
      businessId_locationId_key: { businessId, locationId, key: "PURCHASE" },
    },
    update: { nextValue: { increment: 1 } },
    create: {
      businessId,
      locationId,
      key: "PURCHASE",
      prefix: "PUR-",
      nextValue: 2,
      padding: 6,
    },
    select: { prefix: true, nextValue: true, padding: true },
  });
  const issued = sequence.nextValue - 1n;
  return `${sequence.prefix}${issued.toString().padStart(sequence.padding, "0")}`;
}

export async function saveSupplier(
  context: AuthContext,
  input: SupplierInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertPurchasePermission(context.permissions, "supplier.manage");
  return db.$transaction(async (transaction) => {
    const before = input.id
      ? await transaction.supplier.findFirst({
          where: { id: input.id, businessId: context.business.id },
          select: {
            id: true,
            code: true,
            name: true,
            openingBalance: true,
            isActive: true,
          },
        })
      : null;
    if (input.id && before === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Supplier not found.");
    }
    const data = {
      code: input.code,
      name: input.name,
      contactName: nullable(input.contactName),
      email: nullable(input.email),
      phone: nullable(input.phone),
      address: nullable(input.address),
      taxRegistrationNumber: nullable(input.taxRegistrationNumber),
      paymentTermsDays: input.paymentTermsDays,
      openingBalance: decimal(input.openingBalance),
      isActive: input.isActive,
    };
    const supplier = input.id
      ? await transaction.supplier.update({
          where: { id: input.id, businessId: context.business.id },
          data,
          select: { id: true },
        })
      : await transaction.supplier.create({
          data: { businessId: context.business.id, ...data },
          select: { id: true },
        });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: input.id ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Supplier",
      entityId: supplier.id,
      ...(before === null
        ? {}
        : {
            before: {
              ...before,
              openingBalance: before.openingBalance.toString(),
            },
          }),
      after: {
        code: input.code,
        name: input.name,
        openingBalance: input.openingBalance,
        isActive: input.isActive,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return supplier.id;
  });
}

export async function createPurchase(
  context: AuthContext,
  input: CreatePurchaseInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertPurchasePermission(context.permissions, "purchase.create");
  const totals = calculateLines(input);
  return db.$transaction(async (transaction) => {
    await assertLocation(transaction, context, input.locationId);
    await assertSupplierAndVariants(
      transaction,
      context.business.id,
      input.supplierId,
      input.items.map(({ productVariantId }) => productVariantId),
    );
    const purchase = await transaction.purchase.create({
      data: {
        businessId: context.business.id,
        locationId: input.locationId,
        supplierId: input.supplierId,
        purchaseNumber: await nextPurchaseNumber(
          transaction,
          context.business.id,
          input.locationId,
        ),
        supplierInvoiceNumber: nullable(input.supplierInvoiceNumber),
        purchaseDate: purchaseDate(input.purchaseDate),
        notes: nullable(input.notes),
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        balance: totals.total,
        createdById: context.user.id,
        items: { create: totals.items },
      },
      select: { id: true, purchaseNumber: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: input.locationId,
      actorUserId: context.user.id,
      action: AuditAction.CREATE,
      entityType: "Purchase",
      entityId: purchase.id,
      after: {
        purchaseNumber: purchase.purchaseNumber,
        supplierId: input.supplierId,
        total: totals.total.toString(),
        status: PurchaseStatus.DRAFT,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return purchase.id;
  });
}

export async function updatePurchase(
  context: AuthContext,
  input: UpdatePurchaseInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertPurchasePermission(context.permissions, "purchase.create");
  const totals = calculateLines(input);
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM purchases WHERE id = ${input.purchaseId}::uuid FOR UPDATE`;
    const existing = await transaction.purchase.findFirst({
      where: { id: input.purchaseId, businessId: context.business.id },
      select: { id: true, status: true, paidAmount: true, total: true },
    });
    if (existing === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase not found.");
    }
    assertPurchaseEditable(existing.status);
    if (totals.total.lessThan(existing.paidAmount)) {
      throw new PurchasePolicyError(
        "INVALID_TOTALS",
        "The total cannot be lower than payments already recorded.",
      );
    }
    await assertLocation(transaction, context, input.locationId);
    await assertSupplierAndVariants(
      transaction,
      context.business.id,
      input.supplierId,
      input.items.map(({ productVariantId }) => productVariantId),
    );
    await transaction.purchaseItem.deleteMany({
      where: { purchaseId: existing.id },
    });
    await transaction.purchase.update({
      where: { id: existing.id },
      data: {
        locationId: input.locationId,
        supplierId: input.supplierId,
        supplierInvoiceNumber: nullable(input.supplierInvoiceNumber),
        purchaseDate: purchaseDate(input.purchaseDate),
        notes: nullable(input.notes),
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        balance: totals.total.sub(existing.paidAmount),
        items: { create: totals.items },
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: input.locationId,
      actorUserId: context.user.id,
      action: AuditAction.UPDATE,
      entityType: "Purchase",
      entityId: existing.id,
      before: { total: existing.total.toString() },
      after: { total: totals.total.toString(), status: PurchaseStatus.DRAFT },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function markPurchaseOrdered(
  context: AuthContext,
  purchaseId: string,
  metadata: RequestMetadata,
): Promise<void> {
  assertPurchasePermission(context.permissions, "purchase.create");
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM purchases WHERE id = ${purchaseId}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findFirst({
      where: { id: purchaseId, businessId: context.business.id },
      select: { id: true, status: true, locationId: true },
    });
    if (purchase === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase not found.");
    }
    assertPurchaseOrderable(purchase.status);
    await transaction.purchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.ORDERED, orderedAt: new Date() },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: purchase.locationId,
      actorUserId: context.user.id,
      action: AuditAction.UPDATE,
      entityType: "Purchase",
      entityId: purchase.id,
      before: { status: purchase.status },
      after: { status: PurchaseStatus.ORDERED },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function receivePurchase(
  context: AuthContext,
  input: ReceivePurchaseInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertPurchasePermission(context.permissions, "purchase.receive");
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM purchases WHERE id = ${input.purchaseId}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findFirst({
      where: { id: input.purchaseId, businessId: context.business.id },
      select: {
        id: true,
        purchaseNumber: true,
        locationId: true,
        status: true,
        items: {
          select: {
            id: true,
            productVariantId: true,
            quantity: true,
            receivedQuantity: true,
            unitCost: true,
          },
        },
      },
    });
    if (purchase === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase not found.");
    }
    assertPurchaseReceivable(purchase.status);
    await assertLocation(transaction, context, purchase.locationId);
    const submitted = new Map(
      input.items.map((item) => [item.purchaseItemId, decimal(item.quantity)]),
    );
    if (
      [...submitted.keys()].some(
        (id) => !purchase.items.some((item) => item.id === id),
      )
    ) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase item not found.");
    }
    let receivedAnything = false;
    for (const item of purchase.items) {
      const receiveQuantity = submitted.get(item.id) ?? new Prisma.Decimal(0);
      if (receiveQuantity.isZero()) continue;
      receivedAnything = true;
      const newReceived = item.receivedQuantity.add(receiveQuantity);
      if (newReceived.greaterThan(item.quantity)) {
        throw new PurchasePolicyError(
          "OVER_RECEIPT",
          "Received quantity cannot exceed ordered quantity.",
        );
      }
      await transaction.inventoryBalance.upsert({
        where: {
          businessId_locationId_productVariantId: {
            businessId: context.business.id,
            locationId: purchase.locationId,
            productVariantId: item.productVariantId,
          },
        },
        update: {},
        create: {
          businessId: context.business.id,
          locationId: purchase.locationId,
          productVariantId: item.productVariantId,
        },
      });
      await transaction.$queryRaw`
        SELECT id FROM inventory_balances
        WHERE "businessId" = ${context.business.id}::uuid
          AND "locationId" = ${purchase.locationId}::uuid
          AND "productVariantId" = ${item.productVariantId}::uuid
        FOR UPDATE
      `;
      const balance = await transaction.inventoryBalance.findUniqueOrThrow({
        where: {
          businessId_locationId_productVariantId: {
            businessId: context.business.id,
            locationId: purchase.locationId,
            productVariantId: item.productVariantId,
          },
        },
        select: { quantity: true, averageUnitCost: true },
      });
      const quantityAfter = balance.quantity.add(receiveQuantity);
      const averageUnitCost = quantityAfter.isZero()
        ? item.unitCost
        : balance.quantity
            .mul(balance.averageUnitCost)
            .add(receiveQuantity.mul(item.unitCost))
            .div(quantityAfter)
            .toDecimalPlaces(2);
      await transaction.inventoryBalance.update({
        where: {
          businessId_locationId_productVariantId: {
            businessId: context.business.id,
            locationId: purchase.locationId,
            productVariantId: item.productVariantId,
          },
        },
        data: { quantity: quantityAfter, averageUnitCost },
      });
      await transaction.purchaseItem.update({
        where: { id: item.id },
        data: { receivedQuantity: newReceived },
      });
      await transaction.stockMovement.create({
        data: {
          businessId: context.business.id,
          locationId: purchase.locationId,
          productVariantId: item.productVariantId,
          movementType: StockMovementType.PURCHASE,
          quantityChange: receiveQuantity,
          quantityBefore: balance.quantity,
          quantityAfter,
          unitCost: item.unitCost,
          referenceType: StockReferenceType.PURCHASE,
          referenceId: purchase.id,
          referenceLineId: item.id,
          notes: `Receipt ${purchase.purchaseNumber}`,
          performedById: context.user.id,
        },
      });
    }
    if (!receivedAnything) {
      throw new PurchasePolicyError(
        "INVALID_TOTALS",
        "Enter at least one quantity to receive.",
      );
    }
    const refreshedItems = await transaction.purchaseItem.findMany({
      where: { purchaseId: purchase.id },
      select: { quantity: true, receivedQuantity: true },
    });
    const complete = refreshedItems.every(({ quantity, receivedQuantity }) =>
      receivedQuantity.equals(quantity),
    );
    const now = new Date();
    await transaction.purchase.update({
      where: { id: purchase.id },
      data: {
        status: complete
          ? PurchaseStatus.RECEIVED
          : PurchaseStatus.PARTIALLY_RECEIVED,
        receivedById: context.user.id,
        receivedAt: now,
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: purchase.locationId,
      actorUserId: context.user.id,
      action: AuditAction.PURCHASE_RECEIVED,
      entityType: "Purchase",
      entityId: purchase.id,
      before: { status: purchase.status },
      after: {
        status: complete
          ? PurchaseStatus.RECEIVED
          : PurchaseStatus.PARTIALLY_RECEIVED,
        quantities: input.items,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function recordPurchasePayment(
  context: AuthContext,
  input: PurchasePaymentInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertPurchasePermission(context.permissions, "purchase.create");
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM purchases WHERE id = ${input.purchaseId}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findFirst({
      where: { id: input.purchaseId, businessId: context.business.id },
      select: {
        id: true,
        status: true,
        locationId: true,
        paidAmount: true,
        balance: true,
      },
    });
    if (purchase === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase not found.");
    }
    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new PurchasePolicyError(
        "INVALID_STATUS",
        "A cancelled purchase cannot receive payments.",
      );
    }
    const amount = decimal(input.amount);
    if (amount.greaterThan(purchase.balance)) {
      throw new PurchasePolicyError(
        "PAYMENT_EXCEEDS_BALANCE",
        "Payment cannot exceed the purchase balance.",
      );
    }
    const payment = await transaction.purchasePayment.create({
      data: {
        businessId: context.business.id,
        purchaseId: purchase.id,
        paymentMethod: input.paymentMethod,
        amount,
        reference: nullable(input.reference),
        createdById: context.user.id,
      },
      select: { id: true },
    });
    await transaction.purchase.update({
      where: { id: purchase.id },
      data: {
        paidAmount: purchase.paidAmount.add(amount),
        balance: purchase.balance.sub(amount),
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: purchase.locationId,
      actorUserId: context.user.id,
      action: AuditAction.PURCHASE_PAYMENT_RECORDED,
      entityType: "PurchasePayment",
      entityId: payment.id,
      after: {
        purchaseId: purchase.id,
        amount: amount.toString(),
        paymentMethod: input.paymentMethod,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function cancelPurchase(
  context: AuthContext,
  purchaseId: string,
  metadata: RequestMetadata,
): Promise<void> {
  assertPurchasePermission(context.permissions, "purchase.create");
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM purchases WHERE id = ${purchaseId}::uuid FOR UPDATE`;
    const purchase = await transaction.purchase.findFirst({
      where: { id: purchaseId, businessId: context.business.id },
      select: {
        id: true,
        status: true,
        locationId: true,
        paidAmount: true,
        items: { select: { receivedQuantity: true } },
      },
    });
    if (purchase === null) {
      throw new PurchasePolicyError("NOT_FOUND", "Purchase not found.");
    }
    assertPurchaseCancellable(
      purchase.status,
      purchase.items.some(({ receivedQuantity }) => !receivedQuantity.isZero()),
    );
    if (!purchase.paidAmount.isZero()) {
      throw new PurchasePolicyError(
        "INVALID_STATUS",
        "Refund recorded payments before cancelling this purchase.",
      );
    }
    await transaction.purchase.update({
      where: { id: purchase.id },
      data: { status: PurchaseStatus.CANCELLED },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: purchase.locationId,
      actorUserId: context.user.id,
      action: AuditAction.PURCHASE_CANCELLED,
      entityType: "Purchase",
      entityId: purchase.id,
      before: { status: purchase.status },
      after: { status: PurchaseStatus.CANCELLED },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}
