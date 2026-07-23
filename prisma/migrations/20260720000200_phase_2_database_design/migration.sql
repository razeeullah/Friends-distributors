-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('INCREASE', 'DECREASE', 'STOCKTAKE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductPriceType" AS ENUM ('RETAIL', 'WHOLESALE', 'PROMOTION');

-- CreateEnum
CREATE TYPE "RegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'VOID', 'REFUND', 'APPROVE', 'AUTH_LOGIN_BLOCKED', 'AUTH_ACCOUNT_LOCKED', 'AUTH_LOGIN_FAILED', 'AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGOUT', 'SYSTEM_SEEDED', 'PURCHASE_RECEIVED', 'INVENTORY_ADJUSTED', 'STOCK_TRANSFERRED', 'SALE_COMPLETED');

-- AlterEnum
BEGIN;
CREATE TYPE "SaleStatus_new" AS ENUM ('DRAFT', 'HELD', 'COMPLETED', 'VOIDED', 'REFUNDED');
ALTER TABLE "public"."sales" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sales" ALTER COLUMN "status" TYPE "SaleStatus_new" USING ("status"::text::"SaleStatus_new");
ALTER TYPE "SaleStatus" RENAME TO "SaleStatus_old";
ALTER TYPE "SaleStatus_new" RENAME TO "SaleStatus";
DROP TYPE "public"."SaleStatus_old";
ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "cash_register_movements" DROP CONSTRAINT "cash_register_movements_cashRegisterSessionId_fkey";

-- DropForeignKey
ALTER TABLE "cash_register_sessions" DROP CONSTRAINT "cash_register_sessions_cashRegisterId_fkey";

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_cashRegisterSessionId_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "sale_returns" DROP CONSTRAINT "sale_returns_cashRegisterSessionId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_cashRegisterSessionId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_createdById_fkey";

-- DropIndex
DROP INDEX "cash_register_movements_cashRegisterSessionId_createdAt_idx";

-- DropIndex
DROP INDEX "cash_register_sessions_cashRegisterId_status_openedAt_idx";

-- DropIndex
DROP INDEX "cash_registers_businessId_isActive_idx";

-- DropIndex
DROP INDEX "cash_registers_locationId_code_key";

-- DropIndex
DROP INDEX "inventory_balances_locationId_productVariantId_key";

-- DropIndex
DROP INDEX "permissions_key_key";

-- DropIndex
DROP INDEX "product_variants_barcode_key";

-- DropIndex
DROP INDEX "product_variants_productId_sku_key";

-- DropIndex
DROP INDEX "product_variants_sku_idx";

-- DropIndex
DROP INDEX "purchases_businessId_status_createdAt_idx";

-- DropIndex
DROP INDEX "purchases_supplierId_createdAt_idx";

-- DropIndex
DROP INDEX "sale_payments_paymentMethod_createdAt_idx";

-- DropIndex
DROP INDEX "sale_payments_saleId_idx";

-- DropIndex
DROP INDEX "sales_businessId_saleNumber_key";

-- DropIndex
DROP INDEX "sales_businessId_status_soldAt_idx";

-- DropIndex
DROP INDEX "sales_cashRegisterSessionId_soldAt_idx";

-- DropIndex
DROP INDEX "sales_createdById_soldAt_idx";

-- DropIndex
DROP INDEX "sales_locationId_soldAt_idx";

-- DropIndex
DROP INDEX "stock_movements_locationId_productVariantId_occurredAt_idx";

-- DropIndex
DROP INDEX "users_businessId_isActive_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL;

-- AlterTable
ALTER TABLE "businesses" DROP COLUMN "settings",
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "cash_register_movements" DROP COLUMN "amountMinor",
DROP COLUMN "cashRegisterSessionId",
ADD COLUMN     "amount" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "locationId" UUID NOT NULL,
ADD COLUMN     "registerSessionId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "cash_register_sessions" DROP COLUMN "cashDifferenceMinor",
DROP COLUMN "cashRegisterId",
DROP COLUMN "closingCashMinor",
DROP COLUMN "expectedCashMinor",
DROP COLUMN "openingCashMinor",
ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "cashDifference" DECIMAL(20,2),
ADD COLUMN     "closingCash" DECIMAL(20,2),
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expectedCash" DECIMAL(20,2),
ADD COLUMN     "locationId" UUID NOT NULL,
ADD COLUMN     "openingCash" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "registerId" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "RegisterSessionStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "cash_registers" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "expense_categories" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "amountMinor",
DROP COLUMN "cashRegisterSessionId",
DROP COLUMN "taxMinor",
DROP COLUMN "totalMinor",
ADD COLUMN     "amount" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "registerSessionId" UUID,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(20,2) NOT NULL;

-- AlterTable
ALTER TABLE "inventory_balances" DROP COLUMN "averageUnitCostMinor",
ADD COLUMN     "averageUnitCost" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "barcode",
DROP COLUMN "reorderLevel",
DROP COLUMN "salePriceMinor",
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "color" VARCHAR(80),
ADD COLUMN     "costPrice" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sellingPrice" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "size" VARCHAR(80);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "brand",
ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brandId" UUID,
ADD COLUMN     "minimumStock" DECIMAL(20,4) NOT NULL DEFAULT 0,
ADD COLUMN     "sku" VARCHAR(80) NOT NULL,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unitId" UUID NOT NULL,
ALTER COLUMN "categoryId" SET NOT NULL;

-- AlterTable
ALTER TABLE "purchase_items" DROP COLUMN "discountMinor",
DROP COLUMN "lineSubtotalMinor",
DROP COLUMN "lineTotalMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "unitCostMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineSubtotal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "lineTotal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "purchases" DROP COLUMN "discountMinor",
DROP COLUMN "dueMinor",
DROP COLUMN "paidMinor",
DROP COLUMN "shippingMinor",
DROP COLUMN "subtotalMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "totalMinor",
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchaseDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "shipping" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
ADD COLUMN     "businessId" UUID NOT NULL,
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("businessId", "roleId", "permissionId");

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "sale_items" DROP COLUMN "cogsMinor",
DROP COLUMN "discountMinor",
DROP COLUMN "grossProfitMinor",
DROP COLUMN "lineSubtotalMinor",
DROP COLUMN "lineTotalMinor",
DROP COLUMN "originalUnitPriceMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "unitCostMinor",
DROP COLUMN "unitPriceMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "lineProfit" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "lineSubtotal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "lineTotal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "originalUnitPrice" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "productId" UUID NOT NULL,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "unitPrice" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "sale_payments" DROP COLUMN "amountMinor",
ADD COLUMN     "amount" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "receivedById" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "sale_return_items" DROP COLUMN "cogsReversalMinor",
DROP COLUMN "lineRefundMinor",
DROP COLUMN "taxRefundMinor",
DROP COLUMN "unitCostMinor",
DROP COLUMN "unitRefundMinor",
ADD COLUMN     "cogsReversal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lineRefund" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "taxRefund" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "unitRefund" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "sale_return_refunds" DROP COLUMN "amountMinor",
ADD COLUMN     "amount" DECIMAL(20,2) NOT NULL;

-- AlterTable
ALTER TABLE "sale_returns" DROP COLUMN "cashRegisterSessionId",
DROP COLUMN "cogsReversalMinor",
DROP COLUMN "refundMinor",
DROP COLUMN "subtotalMinor",
DROP COLUMN "taxMinor",
ADD COLUMN     "cogsReversal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "registerSessionId" UUID,
ADD COLUMN     "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "cashRegisterSessionId",
DROP COLUMN "changeMinor",
DROP COLUMN "cogsMinor",
DROP COLUMN "createdById",
DROP COLUMN "grossProfitMinor",
DROP COLUMN "itemDiscountMinor",
DROP COLUMN "orderDiscountMinor",
DROP COLUMN "paidMinor",
DROP COLUMN "saleNumber",
DROP COLUMN "soldAt",
DROP COLUMN "subtotalMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "totalMinor",
ADD COLUMN     "balance" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cartDiscount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cashierId" UUID NOT NULL,
ADD COLUMN     "change" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "completedAt" TIMESTAMPTZ(3),
ADD COLUMN     "costOfGoodsSold" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customerId" UUID,
ADD COLUMN     "grossProfit" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "itemDiscount" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paid" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "receiptNumber" VARCHAR(64) NOT NULL,
ADD COLUMN     "registerId" UUID,
ADD COLUMN     "registerSessionId" UUID,
ADD COLUMN     "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(20,2) NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "businessId" UUID NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "stock_adjustment_items" DROP COLUMN "unitCostMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unitCost" DECIMAL(20,2),
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "stock_adjustments" ADD COLUMN     "adjustmentType" "AdjustmentType" NOT NULL;

-- AlterTable
ALTER TABLE "stock_movements" DROP COLUMN "unitCostMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unitCost" DECIMAL(20,2);

-- AlterTable
ALTER TABLE "stock_transfer_items" DROP COLUMN "unitCostMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "unitCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "stock_transfers" DROP COLUMN "status",
ADD COLUMN     "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "supplier_return_items" DROP COLUMN "lineTotalMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "unitCostMinor",
ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lineTotal" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(20,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "supplier_returns" DROP COLUMN "subtotalMinor",
DROP COLUMN "taxMinor",
DROP COLUMN "totalMinor",
ADD COLUMN     "subtotal" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total" DECIMAL(20,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "archivedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD COLUMN     "businessId" UUID NOT NULL,
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("businessId", "userId", "roleId");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "isActive",
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropEnum
DROP TYPE "CashRegisterSessionStatus";

-- DropEnum
DROP TYPE "StockTransferStatus";

-- CreateTable
CREATE TABLE "business_settings" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locations" (
    "businessId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("businessId","userId","locationId")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "abbreviation" VARCHAR(16) NOT NULL,
    "precision" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_barcodes" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "barcode" VARCHAR(100) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID,
    "productVariantId" UUID NOT NULL,
    "priceType" "ProductPriceType" NOT NULL DEFAULT 'RETAIL',
    "amount" DECIMAL(20,2) NOT NULL,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(32),
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_payments" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "reference" VARCHAR(160),
    "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID,
    "key" VARCHAR(80) NOT NULL,
    "prefix" VARCHAR(32) NOT NULL DEFAULT '',
    "nextValue" BIGINT NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_settings_businessId_idx" ON "business_settings"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_settings_businessId_key_key" ON "business_settings"("businessId", "key");

-- CreateIndex
CREATE INDEX "user_locations_locationId_idx" ON "user_locations"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_locations_userId_locationId_key" ON "user_locations"("userId", "locationId");

-- CreateIndex
CREATE INDEX "brands_businessId_isActive_idx" ON "brands"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "brands_businessId_slug_key" ON "brands"("businessId", "slug");

-- CreateIndex
CREATE INDEX "units_businessId_isActive_idx" ON "units"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "units_businessId_abbreviation_key" ON "units"("businessId", "abbreviation");

-- CreateIndex
CREATE INDEX "product_barcodes_productVariantId_isPrimary_idx" ON "product_barcodes"("productVariantId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_businessId_barcode_key" ON "product_barcodes"("businessId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcodes_productVariantId_barcode_key" ON "product_barcodes"("productVariantId", "barcode");

-- CreateIndex
CREATE INDEX "product_prices_businessId_productVariantId_priceType_isActi_idx" ON "product_prices"("businessId", "productVariantId", "priceType", "isActive");

-- CreateIndex
CREATE INDEX "product_prices_locationId_productVariantId_isActive_idx" ON "product_prices"("locationId", "productVariantId", "isActive");

-- CreateIndex
CREATE INDEX "customers_businessId_isActive_idx" ON "customers"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "customers_businessId_name_idx" ON "customers"("businessId", "name");

-- CreateIndex
CREATE INDEX "customers_businessId_phone_idx" ON "customers"("businessId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customers_businessId_code_key" ON "customers"("businessId", "code");

-- CreateIndex
CREATE INDEX "purchase_payments_businessId_paidAt_idx" ON "purchase_payments"("businessId", "paidAt");

-- CreateIndex
CREATE INDEX "purchase_payments_purchaseId_paidAt_idx" ON "purchase_payments"("purchaseId", "paidAt");

-- CreateIndex
CREATE INDEX "number_sequences_businessId_key_idx" ON "number_sequences"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_businessId_locationId_key_key" ON "number_sequences"("businessId", "locationId", "key");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_movements_businessId_createdAt_idx" ON "cash_register_movements"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_movements_locationId_createdAt_idx" ON "cash_register_movements"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_movements_registerSessionId_createdAt_idx" ON "cash_register_movements"("registerSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_sessions_businessId_status_openedAt_idx" ON "cash_register_sessions"("businessId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "cash_register_sessions_locationId_status_openedAt_idx" ON "cash_register_sessions"("locationId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "cash_register_sessions_registerId_status_openedAt_idx" ON "cash_register_sessions"("registerId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "cash_registers_locationId_isActive_idx" ON "cash_registers"("locationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_businessId_code_key" ON "cash_registers"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_businessId_locationId_productVariantId_key" ON "inventory_balances"("businessId", "locationId", "productVariantId");

-- CreateIndex
CREATE INDEX "permissions_businessId_idx" ON "permissions"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_businessId_key_key" ON "permissions"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_businessId_sku_key" ON "product_variants"("businessId", "sku");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "products_businessId_sku_key" ON "products"("businessId", "sku");

-- CreateIndex
CREATE INDEX "purchases_businessId_status_purchaseDate_idx" ON "purchases"("businessId", "status", "purchaseDate");

-- CreateIndex
CREATE INDEX "purchases_supplierId_purchaseDate_idx" ON "purchases"("supplierId", "purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "sale_items_productId_saleId_idx" ON "sale_items"("productId", "saleId");

-- CreateIndex
CREATE INDEX "sale_payments_businessId_paidAt_idx" ON "sale_payments"("businessId", "paidAt");

-- CreateIndex
CREATE INDEX "sale_payments_saleId_paidAt_idx" ON "sale_payments"("saleId", "paidAt");

-- CreateIndex
CREATE INDEX "sale_payments_paymentMethod_paidAt_idx" ON "sale_payments"("paymentMethod", "paidAt");

-- CreateIndex
CREATE INDEX "sales_businessId_status_completedAt_idx" ON "sales"("businessId", "status", "completedAt");

-- CreateIndex
CREATE INDEX "sales_locationId_createdAt_idx" ON "sales"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_customerId_createdAt_idx" ON "sales"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_registerId_createdAt_idx" ON "sales"("registerId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_registerSessionId_createdAt_idx" ON "sales"("registerSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_cashierId_createdAt_idx" ON "sales"("cashierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_businessId_receiptNumber_key" ON "sales"("businessId", "receiptNumber");

-- CreateIndex
CREATE INDEX "sessions_businessId_expiresAt_idx" ON "sessions"("businessId", "expiresAt");

-- CreateIndex
CREATE INDEX "stock_movements_productVariantId_occurredAt_idx" ON "stock_movements"("productVariantId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_locationId_occurredAt_idx" ON "stock_movements"("locationId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_occurredAt_idx" ON "stock_movements"("occurredAt");

-- CreateIndex
CREATE INDEX "stock_transfers_fromLocationId_status_createdAt_idx" ON "stock_transfers"("fromLocationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "stock_transfers_toLocationId_status_createdAt_idx" ON "stock_transfers"("toLocationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "users_businessId_status_idx" ON "users"("businessId", "status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_businessId_email_key" ON "users"("businessId", "email");

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_registerSessionId_fkey" FOREIGN KEY ("registerSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 2 invariants that Prisma's schema language cannot express.
ALTER TABLE "inventory_balances"
  DROP CONSTRAINT IF EXISTS "inventory_balances_quantity_nonnegative",
  DROP CONSTRAINT IF EXISTS "inventory_balances_cost_nonnegative",
  ADD CONSTRAINT "inventory_balances_average_cost_nonnegative" CHECK ("averageUnitCost" >= 0);

ALTER TABLE "stock_movements"
  DROP CONSTRAINT IF EXISTS "stock_movements_quantity_nonnegative",
  DROP CONSTRAINT IF EXISTS "stock_movements_cost_nonnegative",
  ADD CONSTRAINT "stock_movements_unit_cost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_tax_rate_valid" CHECK ("taxRate" >= 0 AND "taxRate" <= 100),
  ADD CONSTRAINT "products_minimum_stock_nonnegative" CHECK ("minimumStock" >= 0);

ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_prices_nonnegative" CHECK ("costPrice" >= 0 AND "sellingPrice" >= 0);

ALTER TABLE "product_prices"
  ADD CONSTRAINT "product_prices_amount_nonnegative" CHECK ("amount" >= 0),
  ADD CONSTRAINT "product_prices_period_valid" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt");

ALTER TABLE "units"
  ADD CONSTRAINT "units_precision_valid" CHECK ("precision" >= 0 AND "precision" <= 4);

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_money_decimal_nonnegative" CHECK (
    "unitCost" >= 0 AND "discount" >= 0 AND "tax" >= 0 AND
    "lineSubtotal" >= 0 AND "lineTotal" >= 0
  );

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_money_nonnegative" CHECK (
    "subtotal" >= 0 AND "discount" >= 0 AND "tax" >= 0 AND
    "shipping" >= 0 AND "total" >= 0 AND "paidAmount" >= 0 AND "balance" >= 0
  ),
  ADD CONSTRAINT "purchases_received_state_valid" CHECK (
    "status" NOT IN ('PARTIALLY_RECEIVED', 'RECEIVED') OR "receivedAt" IS NOT NULL
  );

ALTER TABLE "purchase_payments"
  ADD CONSTRAINT "purchase_payments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "supplier_return_items"
  ADD CONSTRAINT "supplier_return_items_money_decimal_nonnegative" CHECK (
    "unitCost" >= 0 AND "tax" >= 0 AND "lineTotal" >= 0
  );

ALTER TABLE "supplier_returns"
  ADD CONSTRAINT "supplier_returns_money_nonnegative" CHECK (
    "subtotal" >= 0 AND "tax" >= 0 AND "total" >= 0
  );

ALTER TABLE "stock_adjustment_items"
  ADD CONSTRAINT "stock_adjustment_items_unit_cost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

ALTER TABLE "stock_transfer_items"
  ADD CONSTRAINT "stock_transfer_items_unit_cost_nonnegative" CHECK ("unitCost" >= 0);

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_money_decimal_nonnegative" CHECK (
    "originalUnitPrice" >= 0 AND "unitPrice" >= 0 AND "unitCost" >= 0 AND
    "discount" >= 0 AND "tax" >= 0 AND "lineSubtotal" >= 0 AND
    "lineTotal" >= 0 AND "lineCost" >= 0
  );

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_money_nonnegative" CHECK (
    "subtotal" >= 0 AND "itemDiscount" >= 0 AND "cartDiscount" >= 0 AND
    "tax" >= 0 AND "total" >= 0 AND "paid" >= 0 AND "balance" >= 0 AND
    "change" >= 0 AND "costOfGoodsSold" >= 0
  ),
  ADD CONSTRAINT "sales_completion_state_valid" CHECK (
    ("status" IN ('DRAFT', 'HELD') AND "completedAt" IS NULL AND "voidedAt" IS NULL) OR
    ("status" IN ('COMPLETED', 'REFUNDED') AND "completedAt" IS NOT NULL AND "voidedAt" IS NULL) OR
    ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND "voidReason" IS NOT NULL)
  );

ALTER TABLE "sale_payments"
  ADD CONSTRAINT "sale_payments_amount_decimal_positive" CHECK ("amount" > 0);

ALTER TABLE "sale_return_items"
  ADD CONSTRAINT "sale_return_items_money_decimal_nonnegative" CHECK (
    "unitRefund" >= 0 AND "taxRefund" >= 0 AND "lineRefund" >= 0 AND
    "unitCost" >= 0 AND "cogsReversal" >= 0
  );

ALTER TABLE "sale_return_refunds"
  ADD CONSTRAINT "sale_return_refunds_amount_decimal_positive" CHECK ("amount" > 0);

ALTER TABLE "sale_returns"
  ADD CONSTRAINT "sale_returns_money_nonnegative" CHECK (
    "subtotal" >= 0 AND "tax" >= 0 AND "refundAmount" >= 0 AND "cogsReversal" >= 0
  );

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_money_decimal_nonnegative" CHECK ("amount" >= 0 AND "tax" >= 0 AND "total" >= 0);

ALTER TABLE "cash_register_sessions"
  ADD CONSTRAINT "register_sessions_money_nonnegative" CHECK (
    "openingCash" >= 0 AND ("expectedCash" IS NULL OR "expectedCash" >= 0) AND
    ("closingCash" IS NULL OR "closingCash" >= 0)
  ),
  ADD CONSTRAINT "register_sessions_close_state_valid" CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedById" IS NULL) OR
    ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closingCash" IS NOT NULL)
  );

ALTER TABLE "cash_register_movements"
  ADD CONSTRAINT "cash_movements_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_values_valid" CHECK ("nextValue" > 0 AND "padding" >= 1 AND "padding" <= 20);

CREATE UNIQUE INDEX "product_barcodes_one_primary_per_variant"
ON "product_barcodes" ("productVariantId") WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "register_sessions_one_open_per_register"
ON "cash_register_sessions" ("registerId") WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "number_sequences_global_key_unique"
ON "number_sequences" ("businessId", "key") WHERE "locationId" IS NULL;

DROP TRIGGER IF EXISTS completed_sale_items_are_immutable ON "sale_items";

CREATE OR REPLACE FUNCTION protect_completed_sale_items()
RETURNS trigger AS $$
DECLARE
  parent_status "SaleStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "sales"
  WHERE "id" = COALESCE(NEW."saleId", OLD."saleId");

  IF parent_status IN ('COMPLETED', 'VOIDED', 'REFUNDED') THEN
    RAISE EXCEPTION 'items of a completed, voided, or refunded sale are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER completed_sale_items_are_immutable
BEFORE UPDATE OR DELETE ON "sale_items"
FOR EACH ROW EXECUTE FUNCTION protect_completed_sale_items();

CREATE OR REPLACE FUNCTION prevent_completed_sale_deletion()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('COMPLETED', 'VOIDED', 'REFUNDED') THEN
    RAISE EXCEPTION 'completed sales cannot be deleted; void or refund the sale instead';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_completed_sale_financials()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('COMPLETED', 'VOIDED', 'REFUNDED') AND (
    OLD."businessId" IS DISTINCT FROM NEW."businessId" OR
    OLD."locationId" IS DISTINCT FROM NEW."locationId" OR
    OLD."customerId" IS DISTINCT FROM NEW."customerId" OR
    OLD."registerId" IS DISTINCT FROM NEW."registerId" OR
    OLD."registerSessionId" IS DISTINCT FROM NEW."registerSessionId" OR
    OLD."receiptNumber" IS DISTINCT FROM NEW."receiptNumber" OR
    OLD."subtotal" IS DISTINCT FROM NEW."subtotal" OR
    OLD."itemDiscount" IS DISTINCT FROM NEW."itemDiscount" OR
    OLD."cartDiscount" IS DISTINCT FROM NEW."cartDiscount" OR
    OLD."tax" IS DISTINCT FROM NEW."tax" OR
    OLD."total" IS DISTINCT FROM NEW."total" OR
    OLD."paid" IS DISTINCT FROM NEW."paid" OR
    OLD."balance" IS DISTINCT FROM NEW."balance" OR
    OLD."change" IS DISTINCT FROM NEW."change" OR
    OLD."costOfGoodsSold" IS DISTINCT FROM NEW."costOfGoodsSold" OR
    OLD."grossProfit" IS DISTINCT FROM NEW."grossProfit" OR
    OLD."cashierId" IS DISTINCT FROM NEW."cashierId" OR
    OLD."completedAt" IS DISTINCT FROM NEW."completedAt" OR
    OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  ) THEN
    RAISE EXCEPTION 'completed sale financial and source fields are immutable; void or refund the sale instead';
  END IF;

  IF OLD."status" IN ('COMPLETED', 'VOIDED', 'REFUNDED') AND NEW."status" IN ('DRAFT', 'HELD') THEN
    RAISE EXCEPTION 'a finalized sale cannot be restored to draft or held status';
  END IF;

  IF OLD."status" IN ('VOIDED', 'REFUNDED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'a voided or refunded sale status is final';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
