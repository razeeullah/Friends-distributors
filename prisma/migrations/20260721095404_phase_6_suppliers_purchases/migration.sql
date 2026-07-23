-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'PURCHASE_PAYMENT_RECORDED';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "referenceLineId" UUID;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "openingBalance" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "stock_movements_referenceType_referenceId_referenceLineId_idx" ON "stock_movements"("referenceType", "referenceId", "referenceLineId");
