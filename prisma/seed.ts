import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import {
  DEFAULT_ROLE_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type DefaultRole,
  PERMISSION_DEFINITIONS,
  type PermissionKey,
} from "../src/features/auth/permissions";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  AuditAction,
  ProductPriceType,
  StockMovementType,
  StockReferenceType,
  UserStatus,
} from "../src/generated/prisma/enums";

const seedEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SEED_ADMIN_EMAIL: z.email().default("owner@demo.local"),
  SEED_ADMIN_PASSWORD: z.string().min(12),
  SEED_CASHIER_EMAIL: z.email().default("cashier@demo.local"),
  SEED_CASHIER_PASSWORD: z.string().min(12),
  SEED_BUSINESS_NAME: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .default("Demo Retail Business"),
  SEED_BUSINESS_SLUG: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default("demo-retail-business"),
});

const PASSWORD_HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

async function main(): Promise<void> {
  const environment = seedEnvironmentSchema.parse(process.env);
  const adapter = new PrismaPg({ connectionString: environment.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const [ownerPasswordHash, cashierPasswordHash] = await Promise.all([
      hash(environment.SEED_ADMIN_PASSWORD, PASSWORD_HASH_OPTIONS),
      hash(environment.SEED_CASHIER_PASSWORD, PASSWORD_HASH_OPTIONS),
    ]);

    await prisma.$transaction(async (transaction) => {
      const business = await transaction.business.upsert({
        where: { slug: environment.SEED_BUSINESS_SLUG },
        update: {
          name: environment.SEED_BUSINESS_NAME,
          currencyCode: "PKR",
          timezone: "Asia/Karachi",
          locale: "en-PK",
          archivedAt: null,
        },
        create: {
          slug: environment.SEED_BUSINESS_SLUG,
          name: environment.SEED_BUSINESS_NAME,
          currencyCode: "PKR",
          timezone: "Asia/Karachi",
          locale: "en-PK",
        },
      });

      for (const [key, value] of [
        ["currency", { code: "PKR", fractionDigits: 2 }],
        ["regional", { timezone: "Asia/Karachi", locale: "en-PK" }],
        ["inventory", { costingMethod: "WEIGHTED_AVERAGE" }],
        ["pos", { cashierDiscountLimitPercent: 10 }],
      ] as const) {
        await transaction.businessSetting.upsert({
          where: { businessId_key: { businessId: business.id, key } },
          update: { value },
          create: { businessId: business.id, key, value },
        });
      }

      const location = await transaction.location.upsert({
        where: {
          businessId_code: { businessId: business.id, code: "MAIN" },
        },
        update: {
          name: "Main Store",
          city: "Karachi",
          province: "Sindh",
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          code: "MAIN",
          name: "Main Store",
          city: "Karachi",
          province: "Sindh",
        },
      });

      await transaction.register.upsert({
        where: {
          businessId_code: { businessId: business.id, code: "REG-01" },
        },
        update: {
          locationId: location.id,
          name: "Front Counter",
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          locationId: location.id,
          code: "REG-01",
          name: "Front Counter",
        },
      });

      const permissionIds = new Map<PermissionKey, string>();
      for (const [key, description] of PERMISSION_DEFINITIONS) {
        const permission = await transaction.permission.upsert({
          where: { businessId_key: { businessId: business.id, key } },
          update: { description },
          create: { businessId: business.id, key, description },
        });
        permissionIds.set(key, permission.id);
      }

      const roleIds = new Map<DefaultRole, string>();
      for (const [code, name, description] of DEFAULT_ROLE_DEFINITIONS) {
        const role = await transaction.role.upsert({
          where: { businessId_code: { businessId: business.id, code } },
          update: {
            name,
            description,
            isSystem: true,
            archivedAt: null,
          },
          create: {
            businessId: business.id,
            code,
            name,
            description,
            isSystem: true,
          },
        });
        roleIds.set(code, role.id);

        await transaction.rolePermission.deleteMany({
          where: { roleId: role.id },
        });
        await transaction.rolePermission.createMany({
          data: DEFAULT_ROLE_PERMISSIONS[code].map((permissionKey) => {
            const permissionId = permissionIds.get(permissionKey);
            if (permissionId === undefined) {
              throw new Error(`Missing seeded permission: ${permissionKey}`);
            }
            return { businessId: business.id, roleId: role.id, permissionId };
          }),
        });
      }

      const ownerEmail = environment.SEED_ADMIN_EMAIL.trim().toLowerCase();
      const cashierEmail = environment.SEED_CASHIER_EMAIL.trim().toLowerCase();
      const ownerMatches = await transaction.user.findMany({
        where: { OR: [{ email: ownerEmail }, { username: "owner" }] },
        select: { id: true, businessId: true },
      });
      if (
        ownerMatches.length > 1 ||
        ownerMatches.some(({ businessId }) => businessId !== business.id)
      ) {
        throw new Error(
          "The reserved demo owner email or username belongs to another user.",
        );
      }
      const ownerData = {
        businessId: business.id,
        defaultLocationId: location.id,
        email: ownerEmail,
        displayName: "Demo Owner",
        username: "owner",
        passwordHash: ownerPasswordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        archivedAt: null,
      };
      const owner = ownerMatches[0]
        ? await transaction.user.update({
            where: { id: ownerMatches[0].id },
            data: ownerData,
          })
        : await transaction.user.create({
            data: ownerData,
          });
      const cashierMatches = await transaction.user.findMany({
        where: { OR: [{ email: cashierEmail }, { username: "cashier" }] },
        select: { id: true, businessId: true },
      });
      if (
        cashierMatches.length > 1 ||
        cashierMatches.some(({ businessId }) => businessId !== business.id)
      ) {
        throw new Error(
          "The reserved demo cashier email or username belongs to another user.",
        );
      }
      const cashierData = {
        businessId: business.id,
        defaultLocationId: location.id,
        email: cashierEmail,
        displayName: "Demo Cashier",
        username: "cashier",
        passwordHash: cashierPasswordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
        archivedAt: null,
      };
      const cashier = cashierMatches[0]
        ? await transaction.user.update({
            where: { id: cashierMatches[0].id },
            data: cashierData,
          })
        : await transaction.user.create({
            data: cashierData,
          });

      for (const [userId, roleCode] of [
        [owner.id, "OWNER"],
        [cashier.id, "CASHIER"],
      ] as const) {
        const roleId = roleIds.get(roleCode);
        if (roleId === undefined) {
          throw new Error(`${roleCode} role was not seeded`);
        }
        await transaction.userRole.upsert({
          where: { userId_roleId: { userId, roleId } },
          update: { businessId: business.id },
          create: { businessId: business.id, userId, roleId },
        });
        await transaction.userLocation.upsert({
          where: { userId_locationId: { userId, locationId: location.id } },
          update: { businessId: business.id },
          create: { businessId: business.id, userId, locationId: location.id },
        });
      }

      const groceryCategory = await transaction.category.upsert({
        where: {
          businessId_slug: { businessId: business.id, slug: "groceries" },
        },
        update: { name: "Groceries", isActive: true, archivedAt: null },
        create: {
          businessId: business.id,
          name: "Groceries",
          slug: "groceries",
          description: "Everyday grocery products",
        },
      });
      const beveragesCategory = await transaction.category.upsert({
        where: {
          businessId_slug: { businessId: business.id, slug: "beverages" },
        },
        update: { name: "Beverages", isActive: true, archivedAt: null },
        create: {
          businessId: business.id,
          name: "Beverages",
          slug: "beverages",
          description: "Cold and shelf-stable beverages",
        },
      });
      const localBrand = await transaction.brand.upsert({
        where: {
          businessId_slug: { businessId: business.id, slug: "demo-brand" },
        },
        update: { name: "Demo Brand", isActive: true, archivedAt: null },
        create: {
          businessId: business.id,
          name: "Demo Brand",
          slug: "demo-brand",
        },
      });
      const pieceUnit = await transaction.unit.upsert({
        where: {
          businessId_abbreviation: {
            businessId: business.id,
            abbreviation: "pc",
          },
        },
        update: {
          name: "Piece",
          precision: 0,
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          name: "Piece",
          abbreviation: "pc",
          precision: 0,
        },
      });
      await transaction.unit.upsert({
        where: {
          businessId_abbreviation: {
            businessId: business.id,
            abbreviation: "kg",
          },
        },
        update: {
          name: "Kilogram",
          precision: 3,
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          name: "Kilogram",
          abbreviation: "kg",
          precision: 3,
        },
      });

      await transaction.supplier.upsert({
        where: {
          businessId_code: { businessId: business.id, code: "SUP-001" },
        },
        update: {
          name: "Karachi Wholesale Traders",
          contactName: "Demo Supplier",
          phone: "+92-300-0000000",
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          code: "SUP-001",
          name: "Karachi Wholesale Traders",
          contactName: "Demo Supplier",
          phone: "+92-300-0000000",
          paymentTermsDays: 30,
        },
      });
      await transaction.customer.upsert({
        where: {
          businessId_code: { businessId: business.id, code: "WALK-IN" },
        },
        update: { name: "Walk-in Customer", isActive: true, archivedAt: null },
        create: {
          businessId: business.id,
          code: "WALK-IN",
          name: "Walk-in Customer",
        },
      });

      const riceProduct = await transaction.product.upsert({
        where: {
          businessId_sku: { businessId: business.id, sku: "PRD-RICE" },
        },
        update: {
          categoryId: groceryCategory.id,
          brandId: localBrand.id,
          unitId: pieceUnit.id,
          name: "Basmati Rice",
          slug: "basmati-rice",
          taxable: true,
          taxRate: "0",
          trackInventory: true,
          allowNegativeStock: false,
          minimumStock: "5",
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          categoryId: groceryCategory.id,
          brandId: localBrand.id,
          unitId: pieceUnit.id,
          name: "Basmati Rice",
          slug: "basmati-rice",
          description: "Demo 1 kg basmati rice pack",
          sku: "PRD-RICE",
          taxable: true,
          taxRate: "0",
          minimumStock: "5",
        },
      });
      const drinkProduct = await transaction.product.upsert({
        where: {
          businessId_sku: { businessId: business.id, sku: "PRD-DRINK" },
        },
        update: {
          categoryId: beveragesCategory.id,
          brandId: localBrand.id,
          unitId: pieceUnit.id,
          name: "Sparkling Drink",
          slug: "sparkling-drink",
          taxable: true,
          taxRate: "0",
          trackInventory: true,
          allowNegativeStock: false,
          minimumStock: "12",
          isActive: true,
          archivedAt: null,
        },
        create: {
          businessId: business.id,
          categoryId: beveragesCategory.id,
          brandId: localBrand.id,
          unitId: pieceUnit.id,
          name: "Sparkling Drink",
          slug: "sparkling-drink",
          description: "Demo carbonated beverage",
          sku: "PRD-DRINK",
          taxable: true,
          taxRate: "0",
          minimumStock: "12",
        },
      });

      const variants = [
        {
          productId: riceProduct.id,
          sku: "RICE-1KG",
          name: "1 kg Pack",
          size: "1 kg",
          color: null,
          barcode: "8964000000011",
          costPrice: "260.00",
          sellingPrice: "325.00",
          openingQuantity: "30.0000",
        },
        {
          productId: drinkProduct.id,
          sku: "DRINK-500ML",
          name: "500 ml Bottle",
          size: "500 ml",
          color: null,
          barcode: "8964000000028",
          costPrice: "65.00",
          sellingPrice: "90.00",
          openingQuantity: "48.0000",
        },
      ] as const;

      for (const variantInput of variants) {
        const variant = await transaction.productVariant.upsert({
          where: {
            businessId_sku: {
              businessId: business.id,
              sku: variantInput.sku,
            },
          },
          update: {
            productId: variantInput.productId,
            name: variantInput.name,
            size: variantInput.size,
            color: variantInput.color,
            costPrice: variantInput.costPrice,
            sellingPrice: variantInput.sellingPrice,
            isActive: true,
            archivedAt: null,
          },
          create: {
            businessId: business.id,
            productId: variantInput.productId,
            sku: variantInput.sku,
            name: variantInput.name,
            size: variantInput.size,
            color: variantInput.color,
            costPrice: variantInput.costPrice,
            sellingPrice: variantInput.sellingPrice,
          },
        });

        await transaction.productBarcode.upsert({
          where: {
            businessId_barcode: {
              businessId: business.id,
              barcode: variantInput.barcode,
            },
          },
          update: { productVariantId: variant.id, isPrimary: true },
          create: {
            businessId: business.id,
            productVariantId: variant.id,
            barcode: variantInput.barcode,
            isPrimary: true,
          },
        });

        await transaction.productPrice.deleteMany({
          where: {
            businessId: business.id,
            productVariantId: variant.id,
            locationId: null,
            priceType: ProductPriceType.RETAIL,
          },
        });
        await transaction.productPrice.create({
          data: {
            businessId: business.id,
            productVariantId: variant.id,
            priceType: ProductPriceType.RETAIL,
            amount: variantInput.sellingPrice,
          },
        });

        const existingOpeningMovement =
          await transaction.stockMovement.findFirst({
            where: {
              businessId: business.id,
              locationId: location.id,
              productVariantId: variant.id,
              movementType: StockMovementType.OPENING_STOCK,
              referenceType: StockReferenceType.OPENING_STOCK,
              referenceId: variant.id,
            },
          });

        if (existingOpeningMovement === null) {
          await transaction.inventoryBalance.upsert({
            where: {
              businessId_locationId_productVariantId: {
                businessId: business.id,
                locationId: location.id,
                productVariantId: variant.id,
              },
            },
            update: {
              quantity: variantInput.openingQuantity,
              averageUnitCost: variantInput.costPrice,
            },
            create: {
              businessId: business.id,
              locationId: location.id,
              productVariantId: variant.id,
              quantity: variantInput.openingQuantity,
              averageUnitCost: variantInput.costPrice,
            },
          });
          await transaction.stockMovement.create({
            data: {
              businessId: business.id,
              locationId: location.id,
              productVariantId: variant.id,
              movementType: StockMovementType.OPENING_STOCK,
              quantityChange: variantInput.openingQuantity,
              quantityBefore: "0",
              quantityAfter: variantInput.openingQuantity,
              unitCost: variantInput.costPrice,
              referenceType: StockReferenceType.OPENING_STOCK,
              referenceId: variant.id,
              notes: "Demo opening inventory",
              performedById: owner.id,
            },
          });
        }
      }

      await transaction.expenseCategory.createMany({
        data: [
          { businessId: business.id, code: "UTILITIES", name: "Utilities" },
          { businessId: business.id, code: "RENT", name: "Rent" },
          { businessId: business.id, code: "SUPPLIES", name: "Store Supplies" },
          { businessId: business.id, code: "OTHER", name: "Other" },
        ],
        skipDuplicates: true,
      });

      for (const [key, prefix] of [
        ["SALE", "SAL-"],
        ["PURCHASE", "PUR-"],
        ["SALE_RETURN", "RET-"],
        ["STOCK_ADJUSTMENT", "ADJ-"],
        ["STOCK_TRANSFER", "TRF-"],
        ["EXPENSE", "EXP-"],
      ] as const) {
        await transaction.numberSequence.upsert({
          where: {
            businessId_locationId_key: {
              businessId: business.id,
              locationId: location.id,
              key,
            },
          },
          update: { prefix },
          create: {
            businessId: business.id,
            locationId: location.id,
            key,
            prefix,
          },
        });
      }

      const existingSeedAudit = await transaction.auditLog.findFirst({
        where: {
          businessId: business.id,
          action: AuditAction.SYSTEM_SEEDED,
          entityType: "Business",
          entityId: business.id,
        },
      });
      if (existingSeedAudit === null) {
        await transaction.auditLog.create({
          data: {
            businessId: business.id,
            locationId: location.id,
            actorUserId: owner.id,
            action: AuditAction.SYSTEM_SEEDED,
            entityType: "Business",
            entityId: business.id,
            after: {
              businessSlug: business.slug,
              defaultLocationCode: location.code,
              defaultRoles: DEFAULT_ROLE_DEFINITIONS.map(([code]) => code),
              demoProducts: variants.map(({ sku }) => sku),
            },
          },
        });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
