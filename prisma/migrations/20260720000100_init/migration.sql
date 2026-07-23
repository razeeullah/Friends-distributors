-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_STOCK', 'VOID_REVERSAL');

-- CreateEnum
CREATE TYPE "StockReferenceType" AS ENUM ('PURCHASE', 'SALE', 'SALE_RETURN', 'SUPPLIER_RETURN', 'STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'OPENING_STOCK', 'SALE_VOID');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SaleReturnStatus" AS ENUM ('DRAFT', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_WALLET', 'STORE_CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "CashRegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('CASH_IN', 'CASH_OUT', 'SALE', 'REFUND', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LoginFailureReason" AS ENUM ('INVALID_CREDENTIALS', 'USER_DISABLED', 'USER_LOCKED', 'SESSION_EXPIRED');

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "legalName" VARCHAR(200),
    "taxRegistrationNumber" VARCHAR(80),
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Karachi',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en-PK',
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "businesses_slug_key" ON "businesses"("slug");

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100),
    "province" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "phone" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(240),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" VARCHAR(240),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "userId" UUID,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "succeeded" BOOLEAN NOT NULL,
    "failureReason" "LoginFailureReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "categoryId" UUID,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(120),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "barcode" VARCHAR(80),
    "name" VARCHAR(160) NOT NULL,
    "attributes" JSONB,
    "salePriceMinor" BIGINT NOT NULL,
    "reorderLevel" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "contactName" VARCHAR(160),
    "email" VARCHAR(254),
    "phone" VARCHAR(32),
    "address" TEXT,
    "taxRegistrationNumber" VARCHAR(80),
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseNumber" VARCHAR(64) NOT NULL,
    "supplierInvoiceNumber" VARCHAR(100),
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "orderedAt" TIMESTAMPTZ(3),
    "receivedAt" TIMESTAMPTZ(3),
    "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "shippingMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "paidMinor" BIGINT NOT NULL DEFAULT 0,
    "dueMinor" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "receivedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "receivedQuantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "unitCostMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "lineSubtotalMinor" BIGINT NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_returns" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseId" UUID,
    "returnNumber" VARCHAR(64) NOT NULL,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL DEFAULT 0,
    "reason" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_return_items" (
    "id" UUID NOT NULL,
    "supplierReturnId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "unitCostMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "lineTotalMinor" BIGINT NOT NULL,

    CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "averageUnitCostMinor" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantityChange" DECIMAL(20,4) NOT NULL,
    "quantityBefore" DECIMAL(20,4) NOT NULL,
    "quantityAfter" DECIMAL(20,4) NOT NULL,
    "unitCostMinor" BIGINT,
    "referenceType" "StockReferenceType" NOT NULL,
    "referenceId" UUID NOT NULL,
    "notes" TEXT,
    "performedById" UUID NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "adjustmentNumber" VARCHAR(64) NOT NULL,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(300) NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "completedById" UUID,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment_items" (
    "id" UUID NOT NULL,
    "stockAdjustmentId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantityChange" DECIMAL(20,4) NOT NULL,
    "unitCostMinor" BIGINT,

    CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "fromLocationId" UUID NOT NULL,
    "toLocationId" UUID NOT NULL,
    "transferNumber" VARCHAR(64) NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "completedById" UUID,
    "dispatchedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" UUID NOT NULL,
    "stockTransferId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "receivedQuantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "unitCostMinor" BIGINT NOT NULL,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "cashRegisterSessionId" UUID,
    "saleNumber" VARCHAR(64) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "customerName" VARCHAR(160),
    "customerPhone" VARCHAR(32),
    "subtotalMinor" BIGINT NOT NULL,
    "itemDiscountMinor" BIGINT NOT NULL DEFAULT 0,
    "orderDiscountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "paidMinor" BIGINT NOT NULL,
    "changeMinor" BIGINT NOT NULL DEFAULT 0,
    "cogsMinor" BIGINT NOT NULL,
    "grossProfitMinor" BIGINT NOT NULL,
    "notes" TEXT,
    "soldAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "voidedAt" TIMESTAMPTZ(3),
    "voidedById" UUID,
    "voidReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productVariantId" UUID NOT NULL,
    "productNameSnapshot" VARCHAR(180) NOT NULL,
    "variantNameSnapshot" VARCHAR(160) NOT NULL,
    "skuSnapshot" VARCHAR(80) NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "originalUnitPriceMinor" BIGINT NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "lineSubtotalMinor" BIGINT NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,
    "unitCostMinor" BIGINT NOT NULL,
    "cogsMinor" BIGINT NOT NULL,
    "grossProfitMinor" BIGINT NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_payments" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "reference" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "cashRegisterSessionId" UUID,
    "returnNumber" VARCHAR(64) NOT NULL,
    "status" "SaleReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalMinor" BIGINT NOT NULL DEFAULT 0,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "refundMinor" BIGINT NOT NULL DEFAULT 0,
    "cogsReversalMinor" BIGINT NOT NULL DEFAULT 0,
    "reason" VARCHAR(500) NOT NULL,
    "processedAt" TIMESTAMPTZ(3),
    "processedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_items" (
    "id" UUID NOT NULL,
    "saleReturnId" UUID NOT NULL,
    "saleItemId" UUID NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "unitRefundMinor" BIGINT NOT NULL,
    "taxRefundMinor" BIGINT NOT NULL DEFAULT 0,
    "lineRefundMinor" BIGINT NOT NULL,
    "unitCostMinor" BIGINT NOT NULL,
    "cogsReversalMinor" BIGINT NOT NULL,

    CONSTRAINT "sale_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_refunds" (
    "id" UUID NOT NULL,
    "saleReturnId" UUID NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "reference" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_return_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "expenseCategoryId" UUID NOT NULL,
    "cashRegisterSessionId" UUID,
    "expenseNumber" VARCHAR(64) NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "expenseDate" DATE NOT NULL,
    "vendorName" VARCHAR(180),
    "description" VARCHAR(500) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "receiptReference" VARCHAR(300),
    "createdById" UUID NOT NULL,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register_sessions" (
    "id" UUID NOT NULL,
    "cashRegisterId" UUID NOT NULL,
    "status" "CashRegisterSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" UUID NOT NULL,
    "closedById" UUID,
    "openingCashMinor" BIGINT NOT NULL,
    "expectedCashMinor" BIGINT,
    "closingCashMinor" BIGINT,
    "cashDifferenceMinor" BIGINT,
    "notes" TEXT,
    "openedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "cash_register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register_movements" (
    "id" UUID NOT NULL,
    "cashRegisterSessionId" UUID NOT NULL,
    "movementType" "CashMovementType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "referenceType" VARCHAR(80),
    "referenceId" UUID,
    "notes" VARCHAR(500),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_register_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID,
    "actorUserId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(120) NOT NULL,
    "entityId" VARCHAR(100),
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_businessId_isActive_idx" ON "locations"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "locations_businessId_code_key" ON "locations"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_businessId_isActive_idx" ON "users"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "users_lockedUntil_idx" ON "users"("lockedUntil");

-- CreateIndex
CREATE INDEX "roles_businessId_idx" ON "roles"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_businessId_code_key" ON "roles"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_revokedAt_idx" ON "sessions"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "login_attempts_emailNormalized_createdAt_idx" ON "login_attempts"("emailNormalized", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_createdAt_idx" ON "login_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_userId_createdAt_idx" ON "login_attempts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "categories_businessId_isActive_idx" ON "categories"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "categories_businessId_slug_key" ON "categories"("businessId", "slug");

-- CreateIndex
CREATE INDEX "products_businessId_isActive_idx" ON "products"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "products_businessId_slug_key" ON "products"("businessId", "slug");

-- CreateIndex
CREATE INDEX "product_variants_productId_isActive_idx" ON "product_variants"("productId", "isActive");

-- CreateIndex
CREATE INDEX "product_variants_sku_idx" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_sku_key" ON "product_variants"("productId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");

-- CreateIndex
CREATE INDEX "suppliers_businessId_isActive_idx" ON "suppliers"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "suppliers_businessId_name_idx" ON "suppliers"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_businessId_code_key" ON "suppliers"("businessId", "code");

-- CreateIndex
CREATE INDEX "purchases_businessId_status_createdAt_idx" ON "purchases"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "purchases_supplierId_createdAt_idx" ON "purchases"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "purchases_locationId_receivedAt_idx" ON "purchases"("locationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_businessId_purchaseNumber_key" ON "purchases"("businessId", "purchaseNumber");

-- CreateIndex
CREATE INDEX "purchase_items_productVariantId_idx" ON "purchase_items"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_items_purchaseId_productVariantId_key" ON "purchase_items"("purchaseId", "productVariantId");

-- CreateIndex
CREATE INDEX "supplier_returns_supplierId_createdAt_idx" ON "supplier_returns"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_returns_purchaseId_idx" ON "supplier_returns"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_returns_businessId_returnNumber_key" ON "supplier_returns"("businessId", "returnNumber");

-- CreateIndex
CREATE INDEX "supplier_return_items_productVariantId_idx" ON "supplier_return_items"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_return_items_supplierReturnId_productVariantId_key" ON "supplier_return_items"("supplierReturnId", "productVariantId");

-- CreateIndex
CREATE INDEX "inventory_balances_businessId_productVariantId_idx" ON "inventory_balances"("businessId", "productVariantId");

-- CreateIndex
CREATE INDEX "inventory_balances_locationId_quantity_idx" ON "inventory_balances"("locationId", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_locationId_productVariantId_key" ON "inventory_balances"("locationId", "productVariantId");

-- CreateIndex
CREATE INDEX "stock_movements_businessId_occurredAt_idx" ON "stock_movements"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_locationId_productVariantId_occurredAt_idx" ON "stock_movements"("locationId", "productVariantId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_referenceType_referenceId_idx" ON "stock_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "stock_movements_performedById_occurredAt_idx" ON "stock_movements"("performedById", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_adjustments_locationId_status_createdAt_idx" ON "stock_adjustments"("locationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustments_businessId_adjustmentNumber_key" ON "stock_adjustments"("businessId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "stock_adjustment_items_productVariantId_idx" ON "stock_adjustment_items"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustment_items_stockAdjustmentId_productVariantId_key" ON "stock_adjustment_items"("stockAdjustmentId", "productVariantId");

-- CreateIndex
CREATE INDEX "stock_transfers_fromLocationId_status_createdAt_idx" ON "stock_transfers"("fromLocationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "stock_transfers_toLocationId_status_createdAt_idx" ON "stock_transfers"("toLocationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_businessId_transferNumber_key" ON "stock_transfers"("businessId", "transferNumber");

-- CreateIndex
CREATE INDEX "stock_transfer_items_productVariantId_idx" ON "stock_transfer_items"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_items_stockTransferId_productVariantId_key" ON "stock_transfer_items"("stockTransferId", "productVariantId");

-- CreateIndex
CREATE INDEX "sales_businessId_status_soldAt_idx" ON "sales"("businessId", "status", "soldAt");

-- CreateIndex
CREATE INDEX "sales_locationId_soldAt_idx" ON "sales"("locationId", "soldAt");

-- CreateIndex
CREATE INDEX "sales_cashRegisterSessionId_soldAt_idx" ON "sales"("cashRegisterSessionId", "soldAt");

-- CreateIndex
CREATE INDEX "sales_createdById_soldAt_idx" ON "sales"("createdById", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_businessId_saleNumber_key" ON "sales"("businessId", "saleNumber");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productVariantId_saleId_idx" ON "sale_items"("productVariantId", "saleId");

-- CreateIndex
CREATE INDEX "sale_payments_saleId_idx" ON "sale_payments"("saleId");

-- CreateIndex
CREATE INDEX "sale_payments_paymentMethod_createdAt_idx" ON "sale_payments"("paymentMethod", "createdAt");

-- CreateIndex
CREATE INDEX "sale_returns_saleId_status_idx" ON "sale_returns"("saleId", "status");

-- CreateIndex
CREATE INDEX "sale_returns_locationId_createdAt_idx" ON "sale_returns"("locationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sale_returns_businessId_returnNumber_key" ON "sale_returns"("businessId", "returnNumber");

-- CreateIndex
CREATE INDEX "sale_return_items_saleItemId_idx" ON "sale_return_items"("saleItemId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_return_items_saleReturnId_saleItemId_key" ON "sale_return_items"("saleReturnId", "saleItemId");

-- CreateIndex
CREATE INDEX "sale_return_refunds_saleReturnId_idx" ON "sale_return_refunds"("saleReturnId");

-- CreateIndex
CREATE INDEX "expense_categories_businessId_isActive_idx" ON "expense_categories"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_businessId_code_key" ON "expense_categories"("businessId", "code");

-- CreateIndex
CREATE INDEX "expenses_businessId_status_expenseDate_idx" ON "expenses"("businessId", "status", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_locationId_expenseDate_idx" ON "expenses"("locationId", "expenseDate");

-- CreateIndex
CREATE INDEX "expenses_expenseCategoryId_expenseDate_idx" ON "expenses"("expenseCategoryId", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_businessId_expenseNumber_key" ON "expenses"("businessId", "expenseNumber");

-- CreateIndex
CREATE INDEX "cash_registers_businessId_isActive_idx" ON "cash_registers"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_locationId_code_key" ON "cash_registers"("locationId", "code");

-- CreateIndex
CREATE INDEX "cash_register_sessions_cashRegisterId_status_openedAt_idx" ON "cash_register_sessions"("cashRegisterId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "cash_register_sessions_openedById_openedAt_idx" ON "cash_register_sessions"("openedById", "openedAt");

-- CreateIndex
CREATE INDEX "cash_register_movements_cashRegisterSessionId_createdAt_idx" ON "cash_register_movements"("cashRegisterSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_register_movements_referenceType_referenceId_idx" ON "cash_register_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "audit_logs_businessId_createdAt_idx" ON "audit_logs"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_items" ADD CONSTRAINT "supplier_return_items_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "supplier_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_items" ADD CONSTRAINT "supplier_return_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "stock_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment_items" ADD CONSTRAINT "stock_adjustment_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_items" ADD CONSTRAINT "sale_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_refunds" ADD CONSTRAINT "sale_return_refunds_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Financial and inventory invariants that Prisma cannot express.
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_sale_price_nonnegative" CHECK ("salePriceMinor" >= 0),
  ADD CONSTRAINT "product_variants_reorder_level_nonnegative" CHECK ("reorderLevel" >= 0);

ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_quantity_nonnegative" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "inventory_balances_cost_nonnegative" CHECK ("averageUnitCostMinor" >= 0);

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_consistent" CHECK ("quantityAfter" = "quantityBefore" + "quantityChange"),
  ADD CONSTRAINT "stock_movements_quantity_nonnegative" CHECK ("quantityBefore" >= 0 AND "quantityAfter" >= 0),
  ADD CONSTRAINT "stock_movements_cost_nonnegative" CHECK ("unitCostMinor" IS NULL OR "unitCostMinor" >= 0),
  ADD CONSTRAINT "stock_movements_change_nonzero" CHECK ("quantityChange" <> 0);

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "purchase_items_received_quantity_valid" CHECK ("receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity"),
  ADD CONSTRAINT "purchase_items_money_nonnegative" CHECK (
    "unitCostMinor" >= 0 AND "discountMinor" >= 0 AND "taxMinor" >= 0 AND
    "lineSubtotalMinor" >= 0 AND "lineTotalMinor" >= 0
  );

ALTER TABLE "supplier_return_items"
  ADD CONSTRAINT "supplier_return_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "supplier_return_items_money_nonnegative" CHECK (
    "unitCostMinor" >= 0 AND "taxMinor" >= 0 AND "lineTotalMinor" >= 0
  );

ALTER TABLE "stock_adjustment_items"
  ADD CONSTRAINT "stock_adjustment_items_change_nonzero" CHECK ("quantityChange" <> 0),
  ADD CONSTRAINT "stock_adjustment_items_cost_nonnegative" CHECK ("unitCostMinor" IS NULL OR "unitCostMinor" >= 0);

ALTER TABLE "stock_transfers"
  ADD CONSTRAINT "stock_transfers_distinct_locations" CHECK ("fromLocationId" <> "toLocationId");

ALTER TABLE "stock_transfer_items"
  ADD CONSTRAINT "stock_transfer_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "stock_transfer_items_received_quantity_valid" CHECK ("receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity"),
  ADD CONSTRAINT "stock_transfer_items_cost_nonnegative" CHECK ("unitCostMinor" >= 0);

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sale_items_money_nonnegative" CHECK (
    "originalUnitPriceMinor" >= 0 AND "unitPriceMinor" >= 0 AND
    "discountMinor" >= 0 AND "taxMinor" >= 0 AND
    "lineSubtotalMinor" >= 0 AND "lineTotalMinor" >= 0 AND
    "unitCostMinor" >= 0 AND "cogsMinor" >= 0
  );

ALTER TABLE "sale_return_items"
  ADD CONSTRAINT "sale_return_items_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sale_return_items_money_nonnegative" CHECK (
    "unitRefundMinor" >= 0 AND "taxRefundMinor" >= 0 AND
    "lineRefundMinor" >= 0 AND "unitCostMinor" >= 0 AND "cogsReversalMinor" >= 0
  );

ALTER TABLE "sale_payments"
  ADD CONSTRAINT "sale_payments_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "sale_return_refunds"
  ADD CONSTRAINT "sale_return_refunds_amount_positive" CHECK ("amountMinor" > 0);

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_money_nonnegative" CHECK (
    "amountMinor" >= 0 AND "taxMinor" >= 0 AND "totalMinor" >= 0
  );

ALTER TABLE "cash_register_sessions"
  ADD CONSTRAINT "cash_register_sessions_opening_cash_nonnegative" CHECK ("openingCashMinor" >= 0),
  ADD CONSTRAINT "cash_register_sessions_close_state_valid" CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedById" IS NULL) OR
    ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "closingCashMinor" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION prevent_immutable_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is an immutable ledger table; create a reversal record instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_are_immutable
BEFORE UPDATE OR DELETE ON "stock_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_mutation();

CREATE TRIGGER audit_logs_are_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_mutation();

CREATE TRIGGER login_attempts_are_immutable
BEFORE UPDATE OR DELETE ON "login_attempts"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_mutation();

CREATE TRIGGER cash_register_movements_are_immutable
BEFORE UPDATE OR DELETE ON "cash_register_movements"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_mutation();

CREATE TRIGGER completed_sale_items_are_immutable
BEFORE UPDATE OR DELETE ON "sale_items"
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_ledger_mutation();

CREATE OR REPLACE FUNCTION prevent_completed_sale_deletion()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'completed sales cannot be deleted; void or refund the sale instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER completed_sales_cannot_be_deleted
BEFORE DELETE ON "sales"
FOR EACH ROW EXECUTE FUNCTION prevent_completed_sale_deletion();

CREATE OR REPLACE FUNCTION protect_completed_sale_financials()
RETURNS trigger AS $$
BEGIN
  IF OLD."businessId" IS DISTINCT FROM NEW."businessId"
    OR OLD."locationId" IS DISTINCT FROM NEW."locationId"
    OR OLD."cashRegisterSessionId" IS DISTINCT FROM NEW."cashRegisterSessionId"
    OR OLD."saleNumber" IS DISTINCT FROM NEW."saleNumber"
    OR OLD."customerName" IS DISTINCT FROM NEW."customerName"
    OR OLD."customerPhone" IS DISTINCT FROM NEW."customerPhone"
    OR OLD."subtotalMinor" IS DISTINCT FROM NEW."subtotalMinor"
    OR OLD."itemDiscountMinor" IS DISTINCT FROM NEW."itemDiscountMinor"
    OR OLD."orderDiscountMinor" IS DISTINCT FROM NEW."orderDiscountMinor"
    OR OLD."taxMinor" IS DISTINCT FROM NEW."taxMinor"
    OR OLD."totalMinor" IS DISTINCT FROM NEW."totalMinor"
    OR OLD."paidMinor" IS DISTINCT FROM NEW."paidMinor"
    OR OLD."changeMinor" IS DISTINCT FROM NEW."changeMinor"
    OR OLD."cogsMinor" IS DISTINCT FROM NEW."cogsMinor"
    OR OLD."grossProfitMinor" IS DISTINCT FROM NEW."grossProfitMinor"
    OR OLD."soldAt" IS DISTINCT FROM NEW."soldAt"
    OR OLD."createdById" IS DISTINCT FROM NEW."createdById"
    OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
  THEN
    RAISE EXCEPTION 'completed sale financial and source fields are immutable; void or refund the sale instead';
  END IF;

  IF OLD."status" = 'VOIDED' AND NEW."status" <> 'VOIDED' THEN
    RAISE EXCEPTION 'a voided sale cannot be restored';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER completed_sale_financials_are_immutable
BEFORE UPDATE ON "sales"
FOR EACH ROW EXECUTE FUNCTION protect_completed_sale_financials();
