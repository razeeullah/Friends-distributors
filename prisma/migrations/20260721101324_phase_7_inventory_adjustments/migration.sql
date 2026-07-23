-- AlterTable
ALTER TABLE "stock_adjustment_items" ADD COLUMN     "countedQuantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
ADD COLUMN     "systemQuantity" DECIMAL(20,4) NOT NULL DEFAULT 0;
