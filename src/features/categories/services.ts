import { randomBytes } from "node:crypto";
import { writeAuditLog } from "@/features/audit/write-audit-log";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { AuthContext } from "@/features/auth/session";
import type { CategoryInput } from "@/features/categories/schemas";
import { db } from "@/lib/db";
import { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}
const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "category";
async function slug(
  tx: Prisma.TransactionClient,
  businessId: string,
  name: string,
  id?: string,
) {
  const base = slugify(name);
  const existing = await tx.category.findFirst({
    where: { businessId, slug: base, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  return existing
    ? `${base.slice(0, 125)}-${randomBytes(3).toString("hex")}`
    : base;
}
async function validateParent(
  tx: Prisma.TransactionClient,
  context: AuthContext,
  parentId: string | undefined,
  id?: string,
) {
  if (!parentId) return;
  const parent = await tx.category.findFirst({
    where: { id: parentId, businessId: context.business.id },
    select: { id: true, parentId: true },
  });
  if (!parent) throw new CategoryError("Parent category is unavailable.");
  if (parentId === id)
    throw new CategoryError("A category cannot be its own parent.");
  let cursor = parent;
  while (cursor.parentId) {
    if (cursor.parentId === id)
      throw new CategoryError(
        "A category cannot be moved under its descendant.",
      );
    const next = await tx.category.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true },
    });
    if (!next) break;
    cursor = next;
  }
}
export async function saveCategory(
  context: AuthContext,
  input: CategoryInput,
  metadata: RequestMetadata,
) {
  const permission = input.id ? "category.update" : "category.create";
  if (
    !context.permissions.has(permission) &&
    !context.permissions.has("category.manage")
  )
    throw new CategoryError(`Missing ${permission} permission.`);
  return db.$transaction(async (tx) => {
    await validateParent(tx, context, input.parentId, input.id);
    const current = input.id
      ? await tx.category.findFirst({
          where: { id: input.id, businessId: context.business.id },
        })
      : null;
    if (input.id && !current) throw new CategoryError("Category not found.");
    const record = input.id
      ? await tx.category.update({
          where: { id: input.id },
          data: {
            name: input.name,
            slug: await slug(tx, context.business.id, input.name, input.id),
            description: input.description || null,
            parentId: input.parentId || null,
            imageUrl: input.imageUrl || null,
            displayOrder: input.displayOrder,
            isActive: input.isActive,
            updatedById: context.user.id,
          },
        })
      : await tx.category.create({
          data: {
            businessId: context.business.id,
            name: input.name,
            slug: await slug(tx, context.business.id, input.name),
            description: input.description || null,
            parentId: input.parentId || null,
            imageUrl: input.imageUrl || null,
            displayOrder: input.displayOrder,
            isActive: input.isActive,
            createdById: context.user.id,
          },
        });
    await writeAuditLog(tx, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      action: input.id ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: "Category",
      entityId: record.id,
      summary: `Category ${input.id ? "updated" : "created"}: ${record.name}`,
      ...(current
        ? { before: { name: current.name, parentId: current.parentId } }
        : {}),
      after: { name: record.name, parentId: record.parentId },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
        requestId: metadata.requestId ?? null,
    });
    return record.id;
  });
}
export async function archiveCategory(
  context: AuthContext,
  id: string,
  metadata: RequestMetadata,
  restore = false,
) {
  const permission = restore ? "category.restore" : "category.archive";
  if (
    !context.permissions.has(permission) &&
    !context.permissions.has("category.manage")
  )
    throw new CategoryError(`Missing ${permission} permission.`);
  return db.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id, businessId: context.business.id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw new CategoryError("Category not found.");
    if (restore) {
      const conflict = await tx.category.findFirst({
        where: {
          businessId: context.business.id,
          parentId: category.parentId,
          name: category.name,
          isActive: true,
          archivedAt: null,
          id: { not: id },
        },
      });
      if (conflict)
        throw new CategoryError(
          "An active category with this name already exists under the selected parent.",
        );
    }
    await tx.category.update({
      where: { id },
      data: restore
        ? { archivedAt: null, isActive: true, updatedById: context.user.id }
        : {
            archivedAt: new Date(),
            isActive: false,
            updatedById: context.user.id,
          },
    });
    await writeAuditLog(tx, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      action: restore ? AuditAction.UPDATE : AuditAction.ARCHIVE,
      entityType: "Category",
      entityId: id,
      summary: `Category ${restore ? "restored" : "archived"}: ${category.name}`,
      metadata: {
        productCount: category._count.products,
        childCount: category._count.children,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
        requestId: metadata.requestId ?? null,
    });
  });
}
export async function listCategories(businessId: string) {
  return db.category.findMany({
    where: { businessId },
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true, children: true } },
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
}
