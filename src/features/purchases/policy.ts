import type { PermissionKey } from "@/features/auth/permissions";
import { PurchaseStatus } from "@/generated/prisma/enums";

export class PurchasePolicyError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "OVER_RECEIPT"
      | "PAYMENT_EXCEEDS_BALANCE"
      | "INVALID_TOTALS"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "PurchasePolicyError";
  }
}

export function assertPurchasePermission(
  permissions: ReadonlySet<string>,
  permission: PermissionKey,
): void {
  if (!permissions.has(permission)) {
    throw new PurchasePolicyError("FORBIDDEN", "Permission denied.");
  }
}

export function assertPurchaseEditable(status: PurchaseStatus): void {
  if (status !== PurchaseStatus.DRAFT) {
    throw new PurchasePolicyError(
      "INVALID_STATUS",
      "Only draft purchases can be edited.",
    );
  }
}

export function assertPurchaseOrderable(status: PurchaseStatus): void {
  if (status !== PurchaseStatus.DRAFT) {
    throw new PurchasePolicyError(
      "INVALID_STATUS",
      "Only a draft purchase can be marked as ordered.",
    );
  }
}

export function assertPurchaseReceivable(status: PurchaseStatus): void {
  if (
    status !== PurchaseStatus.ORDERED &&
    status !== PurchaseStatus.PARTIALLY_RECEIVED
  ) {
    throw new PurchasePolicyError(
      "INVALID_STATUS",
      "Only ordered or partially received purchases can be received.",
    );
  }
}

export function assertPurchaseCancellable(
  status: PurchaseStatus,
  hasReceivedItems: boolean,
): void {
  if (
    hasReceivedItems ||
    (status !== PurchaseStatus.DRAFT && status !== PurchaseStatus.ORDERED)
  ) {
    throw new PurchasePolicyError(
      "INVALID_STATUS",
      "Only an unreceived draft or ordered purchase can be cancelled.",
    );
  }
}
