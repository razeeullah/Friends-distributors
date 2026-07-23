-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "minimumStock" DECIMAL(20,4) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "products_businessId_archivedAt_idx" ON "products"("businessId", "archivedAt");

-- CreateIndex
CREATE INDEX "products_businessId_name_idx" ON "products"("businessId", "name");
