ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_RETURNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_VOIDED';

ALTER TABLE "sales"
  ADD COLUMN "refundedAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cogsReversed" DECIMAL(20,2) NOT NULL DEFAULT 0;

ALTER TABLE "sale_returns"
  ADD COLUMN "requestId" UUID;

ALTER TABLE "sale_return_items"
  ADD COLUMN "restockable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "nonRestockableReason" VARCHAR(500);

CREATE UNIQUE INDEX "sale_returns_businessId_requestId_key"
  ON "sale_returns"("businessId", "requestId");
