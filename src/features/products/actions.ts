"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CacheTags } from "@/lib/cache";

import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import { CatalogPolicyError } from "@/features/products/policy";
import {
  archiveProductSchema,
  brandSchema,
  type BrandInput,
  type CatalogActionResult,
  categorySchema,
  type CategoryInput,
  createProductSchema,
  type CreateProductInput,
  unitSchema,
  type UnitInput,
  updateProductSchema,
  type UpdateProductInput,
} from "@/features/products/schemas";
import {
  archiveProduct,
  createProduct,
  saveBrand,
  saveCategory,
  saveUnit,
  updateProduct,
} from "@/features/products/services";
import { Prisma } from "@/generated/prisma/client";

function validationFailure(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): CatalogActionResult {
  return {
    success: false,
    message: "Check the highlighted fields and try again.",
    fieldErrors: Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).filter(
        (entry): entry is [string, string[]] => entry[1] !== undefined,
      ),
    ),
  };
}

function catalogFailure(error: unknown): CatalogActionResult {
  if (error instanceof CatalogPolicyError) {
    return { success: false, message: error.message };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(" ")
      : String(error.meta?.target ?? "");
    return {
      success: false,
      message: target.toLocaleLowerCase("en").includes("barcode")
        ? "That barcode is already in use."
        : "That SKU, name, or abbreviation is already in use.",
    };
  }
  return {
    success: false,
    message: "The catalog request could not be completed.",
  };
}

export async function createProductAction(
  input: CreateProductInput,
): Promise<CatalogActionResult> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("product.create");
  try {
    const productId = await createProduct(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/products");
    return {
      success: true,
      message: "Product created successfully.",
      redirectTo: `/products/${productId}`,
    };
  } catch (error) {
    return catalogFailure(error);
  }
}

export async function updateProductAction(
  input: UpdateProductInput,
): Promise<CatalogActionResult> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("product.update");
  try {
    await updateProduct(context, parsed.data, await getRequestMetadata());
    revalidatePath("/products");
    revalidatePath(`/products/${parsed.data.productId}`);
    return {
      success: true,
      message: "Product updated successfully.",
      redirectTo: `/products/${parsed.data.productId}`,
    };
  } catch (error) {
    return catalogFailure(error);
  }
}

export async function archiveProductAction(input: {
  productId: string;
}): Promise<CatalogActionResult> {
  const parsed = archiveProductSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("product.archive");
  try {
    await archiveProduct(
      context,
      parsed.data.productId,
      await getRequestMetadata(),
    );
    revalidatePath("/products");
    revalidatePath(`/products/${parsed.data.productId}`);
    return { success: true, message: "Product archived successfully." };
  } catch (error) {
    return catalogFailure(error);
  }
}

export async function saveCategoryAction(
  input: CategoryInput,
): Promise<CatalogActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("category.manage");
  try {
    await saveCategory(context, parsed.data, await getRequestMetadata());
    revalidatePath("/products/categories");
    revalidatePath("/products/new");
    updateTag(CacheTags.categories(context.business.id));
    return {
      success: true,
      message: parsed.data.id ? "Category updated." : "Category created.",
    };
  } catch (error) {
    return catalogFailure(error);
  }
}

export async function saveBrandAction(
  input: BrandInput,
): Promise<CatalogActionResult> {
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("category.manage");
  try {
    await saveBrand(context, parsed.data, await getRequestMetadata());
    revalidatePath("/products/brands");
    revalidatePath("/products/new");
    updateTag(CacheTags.brands(context.business.id));
    return {
      success: true,
      message: parsed.data.id ? "Brand updated." : "Brand created.",
    };
  } catch (error) {
    return catalogFailure(error);
  }
}

export async function saveUnitAction(
  input: UnitInput,
): Promise<CatalogActionResult> {
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("category.manage");
  try {
    await saveUnit(context, parsed.data, await getRequestMetadata());
    revalidatePath("/products/units");
    revalidatePath("/products/new");
    updateTag(CacheTags.units(context.business.id));
    return {
      success: true,
      message: parsed.data.id ? "Unit updated." : "Unit created.",
    };
  } catch (error) {
    return catalogFailure(error);
  }
}
