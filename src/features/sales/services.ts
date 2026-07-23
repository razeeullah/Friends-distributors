import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import { decreaseStock, increaseStock } from "@/features/inventory/service";
import { SalePolicyError } from "@/features/sales/policy";
import type {
  CheckoutSaleInput,
  HoldSaleInput,
  QuickCustomerInput,
  SaleReturnInput,
  VoidSaleInput,
} from "@/features/sales/schemas";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditAction,
  CashMovementType,
  PaymentMethod,
  RegisterSessionStatus,
  SaleStatus,
  SaleReturnStatus,
  StockMovementType,
  StockReferenceType,
} from "@/generated/prisma/enums";
import { db } from "@/lib/db";

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
function money(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2);
}
function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
function isManager(context: AuthContext): boolean {
  return context.roleCodes.some((role) =>
    ["SUPER_ADMIN", "OWNER", "MANAGER"].includes(role),
  );
}

async function nextReceiptNumber(
  transaction: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
): Promise<string> {
  const sequence = await transaction.numberSequence.upsert({
    where: {
      businessId_locationId_key: { businessId, locationId, key: "SALE" },
    },
    update: { nextValue: { increment: 1 } },
    create: {
      businessId,
      locationId,
      key: "SALE",
      prefix: "SAL-",
      nextValue: 2,
      padding: 6,
    },
    select: { prefix: true, nextValue: true, padding: true },
  });
  return `${sequence.prefix}${(sequence.nextValue - 1n).toString().padStart(sequence.padding, "0")}`;
}

type PricedLine = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  quantity: Prisma.Decimal;
  originalUnitPrice: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  overrideReason: string | null;
  itemDiscount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxable: boolean;
  trackInventory: boolean;
  fallbackCost: Prisma.Decimal;
  allowNegativeStock: boolean;
  cartDiscount: Prisma.Decimal;
  tax: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

function discountFor(
  base: Prisma.Decimal,
  input: { type: "FIXED" | "PERCENTAGE"; value: string } | undefined,
): Prisma.Decimal {
  if (!input) return ZERO;
  const raw = decimal(input.value);
  const result = input.type === "PERCENTAGE" ? base.mul(raw).div(HUNDRED) : raw;
  if (result.lessThan(0) || result.greaterThan(base))
    throw new SalePolicyError(
      "INVALID_TOTALS",
      "A discount cannot exceed its applicable amount.",
    );
  return money(result);
}

async function priceLines(
  transaction: Prisma.TransactionClient,
  context: AuthContext,
  input: Pick<CheckoutSaleInput, "lines" | "cartDiscount">,
): Promise<{
  lines: PricedLine[];
  subtotal: Prisma.Decimal;
  itemDiscount: Prisma.Decimal;
  cartDiscount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}> {
  const locationId = context.currentLocation?.id;
  if (!locationId)
    throw new SalePolicyError(
      "FORBIDDEN",
      "Select an authorized location before making a sale.",
    );
  const ids = input.lines.map((line) => line.productVariantId);
  if (new Set(ids).size !== ids.length)
    throw new SalePolicyError(
      "INVALID_TOTALS",
      "Add each product once and adjust its quantity in the cart.",
    );
  const variants = await transaction.productVariant.findMany({
    where: {
      id: { in: ids },
      businessId: context.business.id,
      isActive: true,
      archivedAt: null,
      product: { isActive: true, archivedAt: null },
    },
    include: {
      product: true,
      prices: {
        where: {
          isActive: true,
          priceType: "RETAIL",
          OR: [{ locationId }, { locationId: null }],
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
          ],
        },
        orderBy: { locationId: "desc" },
      },
    },
  });
  if (variants.length !== ids.length)
    throw new SalePolicyError(
      "NOT_FOUND",
      "One or more products are inactive or unavailable.",
    );
  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  let subtotal = ZERO;
  let itemDiscount = ZERO;
  const lines = input.lines.map((inputLine) => {
    const variant = byId.get(inputLine.productVariantId);
    if (!variant)
      throw new SalePolicyError("NOT_FOUND", "Product variant not found.");
    const originalUnitPrice =
      variant.prices.find((price) => price.locationId === locationId)?.amount ??
      variant.prices.find((price) => price.locationId === null)?.amount ??
      variant.sellingPrice;
    const requestedPrice = inputLine.unitPrice
      ? decimal(inputLine.unitPrice)
      : originalUnitPrice;
    if (requestedPrice.lessThan(0))
      throw new SalePolicyError(
        "INVALID_TOTALS",
        "A sale price cannot be negative.",
      );
    const overridden = !requestedPrice.equals(originalUnitPrice);
    if (
      overridden &&
      (!context.permissions.has("sale.override_price") ||
        !inputLine.priceOverrideReason)
    )
      throw new SalePolicyError(
        "FORBIDDEN",
        "A reason and the sale.override_price permission are required to override a price.",
      );
    const quantity = decimal(inputLine.quantity);
    const lineSubtotal = money(quantity.mul(requestedPrice));
    const lineDiscount = discountFor(lineSubtotal, inputLine.discount);
    subtotal = subtotal.add(lineSubtotal);
    itemDiscount = itemDiscount.add(lineDiscount);
    return {
      productId: variant.productId,
      productName: variant.product.name,
      variantId: variant.id,
      variantName: variant.name,
      sku: variant.sku,
      quantity,
      originalUnitPrice: money(originalUnitPrice),
      unitPrice: money(requestedPrice),
      overrideReason: overridden
        ? (inputLine.priceOverrideReason?.trim() ?? null)
        : null,
      itemDiscount: lineDiscount,
      taxRate: variant.product.taxRate,
      taxable: variant.product.taxable,
      trackInventory: variant.product.trackInventory,
      fallbackCost: variant.costPrice,
      allowNegativeStock: variant.product.allowNegativeStock,
      cartDiscount: ZERO,
      tax: ZERO,
      lineSubtotal,
      lineTotal: ZERO,
    };
  });
  if (itemDiscount.greaterThan(0) && !context.permissions.has("sale.discount"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.discount permission.");
  const discountedSubtotal = subtotal.sub(itemDiscount);
  const cartDiscount = discountFor(discountedSubtotal, input.cartDiscount);
  if (cartDiscount.greaterThan(0) && !context.permissions.has("sale.discount"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.discount permission.");
  const effectiveDiscountPercent = subtotal.isZero()
    ? ZERO
    : itemDiscount.add(cartDiscount).mul(HUNDRED).div(subtotal);
  const settings = await transaction.businessSetting.findUnique({
    where: { businessId_key: { businessId: context.business.id, key: "pos" } },
    select: { value: true },
  });
  const limit = new Prisma.Decimal(
    typeof settings?.value === "object" &&
      settings.value !== null &&
      "cashierDiscountLimitPercent" in settings.value
      ? String(settings.value.cashierDiscountLimitPercent)
      : "10",
  );
  if (effectiveDiscountPercent.greaterThan(limit) && !isManager(context))
    throw new SalePolicyError(
      "FORBIDDEN",
      "This discount exceeds the cashier limit and requires a manager.",
    );
  let allocated = ZERO;
  let tax = ZERO;
  lines.forEach((line, index) => {
    const netBeforeCart = line.lineSubtotal.sub(line.itemDiscount);
    line.cartDiscount =
      index === lines.length - 1
        ? cartDiscount.sub(allocated)
        : money(cartDiscount.mul(netBeforeCart).div(discountedSubtotal));
    allocated = allocated.add(line.cartDiscount);
    const taxableAmount = netBeforeCart.sub(line.cartDiscount);
    line.tax = line.taxable
      ? money(taxableAmount.mul(line.taxRate).div(HUNDRED))
      : ZERO;
    line.lineTotal = taxableAmount.add(line.tax);
    tax = tax.add(line.tax);
  });
  return {
    lines,
    subtotal: money(subtotal),
    itemDiscount: money(itemDiscount),
    cartDiscount: money(cartDiscount),
    tax: money(tax),
    total: money(subtotal.sub(itemDiscount).sub(cartDiscount).add(tax)),
  };
}

export async function checkoutSale(
  context: AuthContext,
  input: CheckoutSaleInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("sale.create"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.create permission.");
  const locationId = context.currentLocation?.id;
  if (!locationId)
    throw new SalePolicyError(
      "FORBIDDEN",
      "Select a location before checkout.",
    );
  const existing = await db.sale.findUnique({
    where: {
      businessId_checkoutRequestId: {
        businessId: context.business.id,
        checkoutRequestId: input.checkoutRequestId,
      },
    },
    select: { id: true, receiptNumber: true, status: true },
  });
  if (existing?.status === SaleStatus.COMPLETED) return existing;
  try {
    return await db.$transaction(async (transaction) => {
      const registerSession = await transaction.registerSession.findFirst({
        where: {
          businessId: context.business.id,
          locationId,
          status: RegisterSessionStatus.OPEN,
          register: { isActive: true, archivedAt: null },
        },
        orderBy: { openedAt: "desc" },
        select: { id: true, registerId: true },
      });
      if (!registerSession)
        throw new SalePolicyError(
          "REGISTER_CLOSED",
          "An open register session is required before checkout.",
        );
      const calculated = await priceLines(transaction, context, input);
      const paid = money(
        input.payments.reduce(
          (sum, payment) => sum.add(decimal(payment.amount)),
          ZERO,
        ),
      );
      if (paid.lessThan(calculated.total))
        throw new SalePolicyError(
          "INVALID_TOTALS",
          "Payment does not cover the sale total.",
        );
      const overpayment = paid.sub(calculated.total);
      if (
        overpayment.greaterThan(0) &&
        !input.payments.some((payment) => payment.paymentMethod === "CASH")
      )
        throw new SalePolicyError(
          "INVALID_TOTALS",
          "Only cash payments may include change.",
        );
      const receiptNumber = await nextReceiptNumber(
        transaction,
        context.business.id,
        locationId,
      );
      const customer = input.customerId
        ? await transaction.customer.findFirst({
            where: {
              id: input.customerId,
              businessId: context.business.id,
              isActive: true,
              archivedAt: null,
            },
            select: { id: true, name: true, phone: true },
          })
        : null;
      if (input.customerId && !customer)
        throw new SalePolicyError("NOT_FOUND", "Customer not found.");
      const sale = await transaction.sale.create({
        data: {
          businessId: context.business.id,
          locationId,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? null,
          customerPhone: customer?.phone ?? null,
          registerId: registerSession.registerId,
          registerSessionId: registerSession.id,
          receiptNumber,
          checkoutRequestId: input.checkoutRequestId,
          status: SaleStatus.COMPLETED,
          subtotal: calculated.subtotal,
          itemDiscount: calculated.itemDiscount,
          cartDiscount: calculated.cartDiscount,
          tax: calculated.tax,
          total: calculated.total,
          paid,
          balance: ZERO,
          change: overpayment,
          notes: input.notes?.trim() || null,
          cashierId: context.user.id,
          completedAt: new Date(),
        },
        select: { id: true, receiptNumber: true },
      });
      let cogs = ZERO;
      for (const line of calculated.lines) {
        let unitCost = line.fallbackCost;
        const saleItem = await transaction.saleItem.create({
          data: {
            saleId: sale.id,
            productId: line.productId,
            productVariantId: line.variantId,
            productNameSnapshot: line.productName,
            variantNameSnapshot: line.variantName,
            skuSnapshot: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            originalUnitPrice: line.originalUnitPrice,
            priceOverrideReason: line.overrideReason,
            unitCost,
            discount: line.itemDiscount.add(line.cartDiscount),
            tax: line.tax,
            lineSubtotal: line.lineSubtotal,
            lineTotal: line.lineTotal,
            lineCost: ZERO,
            lineProfit: ZERO,
          },
          select: { id: true },
        });
        if (line.trackInventory) {
          const movement = await decreaseStock(transaction, {
            businessId: context.business.id,
            locationId,
            productVariantId: line.variantId,
            quantity: line.quantity.negated(),
            movementType: StockMovementType.SALE,
            referenceType: StockReferenceType.SALE,
            referenceId: sale.id,
            referenceLineId: saleItem.id,
            notes: null,
            performedById: context.user.id,
          });
          unitCost = movement.unitCost;
        }
        const lineCost = money(line.quantity.mul(unitCost));
        const lineProfit = money(line.lineTotal.sub(line.tax).sub(lineCost));
        cogs = cogs.add(lineCost);
        await transaction.saleItem.update({
          where: { id: saleItem.id },
          data: { unitCost, lineCost, lineProfit },
        });
      }
      await transaction.sale.update({
        where: { id: sale.id },
        data: {
          costOfGoodsSold: money(cogs),
          grossProfit: money(calculated.total.sub(calculated.tax).sub(cogs)),
        },
      });
      await transaction.salePayment.createMany({
        data: input.payments.map((payment) => ({
          businessId: context.business.id,
          saleId: sale.id,
          paymentMethod: payment.paymentMethod as PaymentMethod,
          amount: decimal(payment.amount),
          reference: payment.reference?.trim() || null,
          receivedById: context.user.id,
        })),
      });
      const cashPaid = input.payments
        .filter((payment) => payment.paymentMethod === "CASH")
        .reduce((sum, payment) => sum.add(decimal(payment.amount)), ZERO)
        .sub(overpayment);
      if (cashPaid.greaterThan(0))
        await transaction.cashMovement.create({
          data: {
            businessId: context.business.id,
            locationId,
            registerSessionId: registerSession.id,
            movementType: CashMovementType.SALE,
            amount: money(cashPaid),
            referenceType: "SALE",
            referenceId: sale.id,
            notes: `Receipt ${receiptNumber}`,
            createdById: context.user.id,
          },
        });
      await writeAuditLog(transaction, {
        businessId: context.business.id,
        locationId,
        actorUserId: context.user.id,
        action: AuditAction.SALE_COMPLETED,
        entityType: "Sale",
        entityId: sale.id,
        after: {
          receiptNumber,
          total: calculated.total.toString(),
          cogs: money(cogs).toString(),
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      if (calculated.lines.some((line) => line.overrideReason))
        await writeAuditLog(transaction, {
          businessId: context.business.id,
          locationId,
          actorUserId: context.user.id,
          action: AuditAction.SALE_PRICE_OVERRIDDEN,
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            lines: calculated.lines
              .filter((line) => line.overrideReason)
              .map((line) => ({ sku: line.sku, reason: line.overrideReason })),
          },
        });
      if (
        calculated.subtotal.greaterThan(0) &&
        calculated.itemDiscount
          .add(calculated.cartDiscount)
          .mul(HUNDRED)
          .div(calculated.subtotal)
          .greaterThan(10)
      )
        await writeAuditLog(transaction, {
          businessId: context.business.id,
          locationId,
          actorUserId: context.user.id,
          action: AuditAction.SALE_LARGE_DISCOUNT,
          entityType: "Sale",
          entityId: sale.id,
          metadata: {
            discount: calculated.itemDiscount
              .add(calculated.cartDiscount)
              .toString(),
          },
        });
      return sale;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await db.sale.findUnique({
        where: {
          businessId_checkoutRequestId: {
            businessId: context.business.id,
            checkoutRequestId: input.checkoutRequestId,
          },
        },
        select: { id: true, receiptNumber: true, status: true },
      });
      if (duplicate?.status === SaleStatus.COMPLETED) return duplicate;
    }
    throw error;
  }
}

export async function holdSale(
  context: AuthContext,
  input: HoldSaleInput,
  metadata: RequestMetadata,
): Promise<{ id: string; receiptNumber: string }> {
  if (!context.permissions.has("sale.create"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.create permission.");
  const locationId = context.currentLocation?.id;
  if (!locationId)
    throw new SalePolicyError(
      "FORBIDDEN",
      "Select a location before holding a sale.",
    );
  return db.$transaction(async (transaction) => {
    const calculated = await priceLines(transaction, context, input);
    const receiptNumber = await nextReceiptNumber(
      transaction,
      context.business.id,
      locationId,
    );
    const sale = await transaction.sale.create({
      data: {
        businessId: context.business.id,
        locationId,
        receiptNumber,
        status: SaleStatus.HELD,
        subtotal: calculated.subtotal,
        itemDiscount: calculated.itemDiscount,
        cartDiscount: calculated.cartDiscount,
        tax: calculated.tax,
        total: calculated.total,
        notes: input.notes?.trim() || null,
        cashierId: context.user.id,
        items: {
          create: calculated.lines.map((line) => ({
            productId: line.productId,
            productVariantId: line.variantId,
            productNameSnapshot: line.productName,
            variantNameSnapshot: line.variantName,
            skuSnapshot: line.sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            originalUnitPrice: line.originalUnitPrice,
            priceOverrideReason: line.overrideReason,
            unitCost: line.fallbackCost,
            discount: line.itemDiscount.add(line.cartDiscount),
            tax: line.tax,
            lineSubtotal: line.lineSubtotal,
            lineTotal: line.lineTotal,
            lineCost: ZERO,
            lineProfit: ZERO,
          })),
        },
      },
      select: { id: true, receiptNumber: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId,
      actorUserId: context.user.id,
      action: AuditAction.SALE_HELD,
      entityType: "Sale",
      entityId: sale.id,
      metadata: { receiptNumber },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return sale;
  });
}

export async function quickCreateCustomer(
  context: AuthContext,
  input: QuickCustomerInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("customer.create"))
    throw new SalePolicyError(
      "FORBIDDEN",
      "Missing customer.create permission.",
    );
  return db.$transaction(async (transaction) => {
    const customer = await transaction.customer.create({
      data: {
        businessId: context.business.id,
        code: `CUS-${randomUUID().slice(0, 8).toUpperCase()}`,
        name: input.name,
        phone: input.phone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
      },
      select: { id: true, name: true, phone: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.CREATE,
      entityType: "Customer",
      entityId: customer.id,
      after: { name: customer.name },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return customer;
  });
}

async function nextReturnNumber(
  transaction: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
): Promise<string> {
  const sequence = await transaction.numberSequence.upsert({
    where: {
      businessId_locationId_key: { businessId, locationId, key: "SALE_RETURN" },
    },
    update: { nextValue: { increment: 1 } },
    create: {
      businessId,
      locationId,
      key: "SALE_RETURN",
      prefix: "RET-",
      nextValue: 2,
      padding: 6,
    },
    select: { prefix: true, nextValue: true, padding: true },
  });
  return `${sequence.prefix}${(sequence.nextValue - 1n).toString().padStart(sequence.padding, "0")}`;
}

export async function createSaleReturn(
  context: AuthContext,
  input: SaleReturnInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("sale.refund"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.refund permission.");
  const existing = await db.saleReturn.findUnique({
    where: {
      businessId_requestId: {
        businessId: context.business.id,
        requestId: input.requestId,
      },
    },
    select: { id: true, returnNumber: true },
  });
  if (existing) return existing;
  try {
    return await db.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT id FROM sales
        WHERE id = ${input.saleId}::uuid
          AND "businessId" = ${context.business.id}::uuid
        FOR UPDATE
      `;
      const sale = await transaction.sale.findFirst({
        where: {
          id: input.saleId,
          businessId: context.business.id,
          locationId: { in: context.locations.map((location) => location.id) },
          status: SaleStatus.COMPLETED,
        },
        include: {
          items: {
            include: {
              returnItems: {
                where: { saleReturn: { status: SaleReturnStatus.COMPLETED } },
                select: { quantity: true },
              },
            },
          },
        },
      });
      if (!sale)
        throw new SalePolicyError(
          "NOT_FOUND",
          "Only completed sales without a final refund can be returned.",
        );
      const registerSession = await transaction.registerSession.findFirst({
        where: {
          ...(sale.registerSessionId ? { id: sale.registerSessionId } : {}),
          businessId: context.business.id,
          status: RegisterSessionStatus.OPEN,
        },
        select: { id: true },
      });
      const itemsById = new Map(sale.items.map((item) => [item.id, item]));
      let subtotal = ZERO;
      let tax = ZERO;
      let refundAmount = ZERO;
      let cogsReversal = ZERO;
      for (const requested of input.items) {
        const item = itemsById.get(requested.saleItemId);
        if (!item)
          throw new SalePolicyError(
            "NOT_FOUND",
            "A returned item is not part of this sale.",
          );
        const quantity = decimal(requested.quantity);
        const alreadyReturned = item.returnItems.reduce(
          (sum, entry) => sum.add(entry.quantity),
          ZERO,
        );
        if (quantity.add(alreadyReturned).greaterThan(item.quantity))
          throw new SalePolicyError(
            "INVALID_TOTALS",
            "Return quantity exceeds the remaining returnable quantity.",
          );
        if (!requested.restockable && !requested.nonRestockableReason)
          throw new SalePolicyError(
            "INVALID_TOTALS",
            "A damaged or non-restockable item requires a reason.",
          );
        const ratio = quantity.div(item.quantity);
        subtotal = subtotal.add(money(item.lineSubtotal.mul(ratio)));
        tax = tax.add(money(item.tax.mul(ratio)));
        refundAmount = refundAmount.add(money(item.lineTotal.mul(ratio)));
        cogsReversal = cogsReversal.add(money(item.lineCost.mul(ratio)));
      }
      const returnNumber = await nextReturnNumber(
        transaction,
        context.business.id,
        sale.locationId,
      );
      const result = await transaction.saleReturn.create({
        data: {
          businessId: context.business.id,
          locationId: sale.locationId,
          saleId: sale.id,
          registerSessionId: registerSession?.id ?? null,
          returnNumber,
          requestId: input.requestId,
          status: SaleReturnStatus.COMPLETED,
          subtotal: money(subtotal),
          tax: money(tax),
          refundAmount: money(refundAmount),
          cogsReversal: money(cogsReversal),
          reason: input.reason,
          processedAt: new Date(),
          processedById: context.user.id,
          items: {
            create: input.items.map((requested) => {
              const item = itemsById.get(requested.saleItemId)!;
              const quantity = decimal(requested.quantity);
              const ratio = quantity.div(item.quantity);
              return {
                saleItemId: item.id,
                quantity,
                unitRefund: money(item.lineTotal.div(item.quantity)),
                taxRefund: money(item.tax.mul(ratio)),
                lineRefund: money(item.lineTotal.mul(ratio)),
                unitCost: item.unitCost,
                cogsReversal: money(item.lineCost.mul(ratio)),
                restockable: requested.restockable,
                nonRestockableReason: requested.restockable
                  ? null
                  : requested.nonRestockableReason?.trim() || null,
              };
            }),
          },
          refunds: {
            create: {
              paymentMethod: input.refundMethod as PaymentMethod,
              amount: money(refundAmount),
            },
          },
        },
        select: { id: true, returnNumber: true },
      });
      for (const requested of input.items) {
        if (!requested.restockable) continue;
        const item = itemsById.get(requested.saleItemId)!;
        await increaseStock(transaction, {
          businessId: context.business.id,
          locationId: sale.locationId,
          productVariantId: item.productVariantId,
          quantity: decimal(requested.quantity),
          unitCost: item.unitCost,
          movementType: StockMovementType.CUSTOMER_RETURN,
          referenceType: StockReferenceType.SALE_RETURN,
          referenceId: result.id,
          referenceLineId: null,
          notes: input.reason,
          performedById: context.user.id,
        });
      }
      if (input.refundMethod === "CASH" && registerSession)
        await transaction.cashMovement.create({
          data: {
            businessId: context.business.id,
            locationId: sale.locationId,
            registerSessionId: registerSession.id,
            movementType: CashMovementType.REFUND,
            amount: money(refundAmount).negated(),
            referenceType: "SALE_RETURN",
            referenceId: result.id,
            notes: input.reason,
            createdById: context.user.id,
          },
        });
      const updatedRefunded = sale.refundedAmount.add(refundAmount);
      const updatedCogs = sale.cogsReversed.add(cogsReversal);
      const status = updatedRefunded.greaterThanOrEqualTo(sale.total)
        ? SaleStatus.REFUNDED
        : SaleStatus.COMPLETED;
      await transaction.sale.update({
        where: { id: sale.id },
        data: {
          refundedAmount: updatedRefunded,
          cogsReversed: updatedCogs,
          status,
        },
      });
      await writeAuditLog(transaction, {
        businessId: context.business.id,
        locationId: sale.locationId,
        actorUserId: context.user.id,
        action: AuditAction.SALE_RETURNED,
        entityType: "SaleReturn",
        entityId: result.id,
        after: { saleId: sale.id, refundAmount: refundAmount.toString() },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
      return result;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await db.saleReturn.findUnique({
        where: {
          businessId_requestId: {
            businessId: context.business.id,
            requestId: input.requestId,
          },
        },
        select: { id: true, returnNumber: true },
      });
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export async function voidSale(
  context: AuthContext,
  input: VoidSaleInput,
  metadata: RequestMetadata,
) {
  if (!context.permissions.has("sale.void"))
    throw new SalePolicyError("FORBIDDEN", "Missing sale.void permission.");
  return db.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT id FROM sales
      WHERE id = ${input.saleId}::uuid
        AND "businessId" = ${context.business.id}::uuid
      FOR UPDATE
    `;
    const sale = await transaction.sale.findFirst({
      where: {
        id: input.saleId,
        businessId: context.business.id,
        locationId: { in: context.locations.map((location) => location.id) },
      },
      include: {
        items: true,
        returns: {
          where: { status: SaleReturnStatus.COMPLETED },
          select: { id: true },
        },
      },
    });
    if (!sale || sale.status !== SaleStatus.COMPLETED)
      throw new SalePolicyError(
        "NOT_FOUND",
        "Only completed sales can be voided.",
      );
    if (sale.returns.length)
      throw new SalePolicyError(
        "INVALID_TOTALS",
        "A sale with completed returns cannot be voided.",
      );
    for (const item of sale.items) {
      const product = await transaction.product.findUnique({
        where: { id: item.productId },
        select: { trackInventory: true },
      });
      if (!product?.trackInventory) continue;
      await increaseStock(transaction, {
        businessId: context.business.id,
        locationId: sale.locationId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        movementType: StockMovementType.VOID_REVERSAL,
        referenceType: StockReferenceType.SALE_VOID,
        referenceId: sale.id,
        referenceLineId: item.id,
        notes: input.reason,
        performedById: context.user.id,
      });
    }
    await transaction.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.VOIDED,
        voidedAt: new Date(),
        voidedById: context.user.id,
        voidReason: input.reason,
        paid: ZERO,
        balance: ZERO,
        change: ZERO,
        grossProfit: ZERO,
      },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: sale.locationId,
      actorUserId: context.user.id,
      action: AuditAction.SALE_VOIDED,
      entityType: "Sale",
      entityId: sale.id,
      after: { reason: input.reason },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return { id: sale.id, receiptNumber: sale.receiptNumber };
  });
}
