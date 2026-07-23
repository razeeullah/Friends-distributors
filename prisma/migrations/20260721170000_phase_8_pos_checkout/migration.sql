ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MIXED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_HELD';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_PRICE_OVERRIDDEN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SALE_LARGE_DISCOUNT';

ALTER TABLE "sales"
  ADD COLUMN "checkoutRequestId" UUID;

ALTER TABLE "sale_items"
  ADD COLUMN "priceOverrideReason" VARCHAR(500);

CREATE UNIQUE INDEX "sales_businessId_checkoutRequestId_key"
  ON "sales"("businessId", "checkoutRequestId");
