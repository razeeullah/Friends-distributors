import { z } from "zod";

import { UserStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { createPaginationMeta, parsePagination } from "@/lib/pagination";

export const userListQuerySchema = z.object({
  search: z.string().trim().max(160).optional().default(""),
  status: z.enum(UserStatus).optional(),
  roleId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  sort: z
    .enum(["name_asc", "name_desc", "created_asc", "created_desc"])
    .default("name_asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

function userOrderBy(sort: UserListQuery["sort"]) {
  switch (sort) {
    case "name_desc":
      return { displayName: "desc" as const };
    case "created_asc":
      return { createdAt: "asc" as const };
    case "created_desc":
      return { createdAt: "desc" as const };
    default:
      return { displayName: "asc" as const };
  }
}

export async function listUsers(businessId: string, rawQuery: unknown) {
  const query = userListQuerySchema.parse(rawQuery);
  const pagination = parsePagination(query);
  const where = {
    businessId,
    archivedAt: null,
    ...(query.status === undefined ? {} : { status: query.status }),
    ...(query.roleId === undefined
      ? {}
      : { roles: { some: { roleId: query.roleId } } }),
    ...(query.locationId === undefined
      ? {}
      : { locations: { some: { locationId: query.locationId } } }),
    ...(query.search.length === 0
      ? {}
      : {
          OR: [
            {
              displayName: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
            { email: { contains: query.search, mode: "insensitive" as const } },
            {
              username: {
                contains: query.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }),
  };

  const [items, totalItems] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: userOrderBy(query.sort),
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        createdAt: true,
        defaultLocationId: true,
        roles: {
          where: { role: { archivedAt: null } },
          select: { role: { select: { id: true, code: true, name: true } } },
        },
        locations: {
          select: {
            location: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return {
    items,
    query,
    pagination: createPaginationMeta({
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems,
    }),
  };
}

export async function getUserAdministrationOptions(businessId: string) {
  const [roles, locations] = await Promise.all([
    db.role.findMany({
      where: { businessId, archivedAt: null },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        isSystem: true,
        permissions: {
          select: { permission: { select: { key: true } } },
        },
      },
    }),
    db.location.findMany({
      where: { businessId, isActive: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return { roles, locations };
}

export async function getUserDetails(businessId: string, userId: string) {
  return db.user.findFirst({
    where: { id: userId, businessId, archivedAt: null },
    select: {
      id: true,
      displayName: true,
      email: true,
      username: true,
      phone: true,
      status: true,
      defaultLocationId: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      lockedUntil: true,
      roles: {
        where: { role: { archivedAt: null } },
        select: { role: { select: { id: true, code: true, name: true } } },
      },
      locations: {
        select: { location: { select: { id: true, code: true, name: true } } },
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        select: {
          id: true,
          currentLocationId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });
}

export async function listRoles(businessId: string) {
  return db.role.findMany({
    where: { businessId, archivedAt: null },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      _count: { select: { users: true, permissions: true } },
    },
  });
}

export async function getRoleEditorData(businessId: string, roleId?: string) {
  const [permissions, role] = await Promise.all([
    db.permission.findMany({
      where: { businessId },
      orderBy: { key: "asc" },
      select: { id: true, key: true, description: true },
    }),
    roleId === undefined
      ? Promise.resolve(null)
      : db.role.findFirst({
          where: { id: roleId, businessId, archivedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            isSystem: true,
            permissions: { select: { permissionId: true } },
          },
        }),
  ]);

  return { permissions, role };
}

export function summarizeUserAgent(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim().length === 0) {
    return "Unknown device";
  }
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const platform = userAgent.includes("Windows")
    ? "Windows"
    : userAgent.includes("Macintosh")
      ? "macOS"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("iPhone") || userAgent.includes("iPad")
          ? "iOS"
          : "Unknown OS";
  return `${browser} on ${platform}`;
}
