import type { PermissionKey } from "@/features/auth/permissions";
import { StockAdjustmentStatus } from "@/generated/prisma/enums";

export class InventoryPolicyError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_STATUS"
      | "NEGATIVE_STOCK"
      | "INVALID_ADJUSTMENT"
      | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "InventoryPolicyError";
  }
}

export function assertInventoryPermission(
  permissions: ReadonlySet<string>,
  permission: PermissionKey,
): void {
  if (!permissions.has(permission)) {
    throw new InventoryPolicyError("FORBIDDEN", "Permission denied.");
  }
}

export function assertAdjustmentDraft(status: StockAdjustmentStatus): void {
  if (status !== StockAdjustmentStatus.DRAFT) {
    throw new InventoryPolicyError(
      "INVALID_STATUS",
      "Only a draft adjustment can be posted.",
    );
  }
}
