import { randomBytes } from "node:crypto";

import type { AuthContext } from "@/features/auth/session";
import type { PermissionKey } from "@/features/auth/permissions";
import { hashPassword } from "@/features/auth/password";
import { writeAuditLog } from "@/features/audit/write-audit-log";
import {
  AdministrationPolicyError,
  assertAssignablePermissions,
  assertLastAdministratorPreserved,
  DANGEROUS_PERMISSION_KEYS,
  isProtectedAdminRole,
} from "@/features/users/administration-policy";
import type {
  CreateRoleInput,
  CreateUserInput,
  ResetPasswordInput,
  UpdateRoleInput,
  UpdateUserInput,
} from "@/features/users/schemas";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import { AuditAction, UserStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

function roleCodeFromName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 48);
  return `CUSTOM_${normalized || "ROLE"}`;
}

function isUnrestricted(context: AuthContext): boolean {
  return context.permissions.has("role.manage.unrestricted");
}

function assertAdministrationPermission(
  context: AuthContext,
  permission: PermissionKey,
): void {
  if (!context.permissions.has(permission)) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "You do not have permission to perform this administration action.",
    );
  }
}

async function resolveAssignments(
  businessId: string,
  roleIds: readonly string[],
  locationIds: readonly string[],
) {
  const [roles, locations] = await Promise.all([
    db.role.findMany({
      where: { id: { in: [...roleIds] }, businessId, archivedAt: null },
      select: {
        id: true,
        code: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    }),
    db.location.findMany({
      where: {
        id: { in: [...locationIds] },
        businessId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    }),
  ]);

  if (roles.length !== new Set(roleIds).size) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "One or more selected roles are unavailable.",
    );
  }
  if (locations.length !== new Set(locationIds).size) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "One or more selected locations are unavailable.",
    );
  }
  return { roles, locations };
}

function assertRoleAssignmentAllowed(
  context: AuthContext,
  roles: readonly {
    permissions: readonly { permission: { key: string } }[];
  }[],
): void {
  assertAssignablePermissions({
    actorPermissions: context.permissions,
    requestedPermissions: roles.flatMap(({ permissions }) =>
      permissions.map(({ permission }) => permission.key),
    ),
    unrestricted: isUnrestricted(context),
  });
}

export async function createManagedUser(
  context: AuthContext,
  input: CreateUserInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertAdministrationPermission(context, "user.manage");
  const assignments = await resolveAssignments(
    context.business.id,
    input.roleIds,
    input.locationIds,
  );
  assertRoleAssignmentAllowed(context, assignments.roles);
  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        businessId: context.business.id,
        defaultLocationId: input.defaultLocationId,
        displayName: input.displayName,
        email: input.email,
        username: input.username,
        phone: input.phone || null,
        passwordHash,
        status: input.status,
        roles: {
          create: input.roleIds.map((roleId) => ({
            businessId: context.business.id,
            roleId,
          })),
        },
        locations: {
          create: input.locationIds.map((locationId) => ({
            businessId: context.business.id,
            locationId,
          })),
        },
      },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      after: {
        displayName: input.displayName,
        email: input.email,
        username: input.username,
        status: input.status,
        roleIds: input.roleIds,
        locationIds: input.locationIds,
        defaultLocationId: input.defaultLocationId,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return user.id;
  });
}

export async function updateManagedUser(
  context: AuthContext,
  input: UpdateUserInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertAdministrationPermission(context, "user.manage");
  const assignments = await resolveAssignments(
    context.business.id,
    input.roleIds,
    input.locationIds,
  );
  assertRoleAssignmentAllowed(context, assignments.roles);

  const nextHasProtectedRole = assignments.roles.some(({ code }) =>
    isProtectedAdminRole(code),
  );

  const now = new Date();
  await db.$transaction(async (transaction) => {
    await transaction.$queryRaw<readonly { locked: number }[]>`
      SELECT 1 AS locked
      FROM pg_advisory_xact_lock(hashtext(${`protected-admin:${context.business.id}`}))
    `;
    const currentTarget = await transaction.user.findFirst({
      where: {
        id: input.userId,
        businessId: context.business.id,
        archivedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        phone: true,
        status: true,
        defaultLocationId: true,
        roles: { select: { roleId: true, role: { select: { code: true } } } },
        locations: { select: { locationId: true } },
      },
    });
    if (currentTarget === null) {
      throw new Error("User not found");
    }
    const targetHasProtectedRole = currentTarget.roles.some(({ role }) =>
      isProtectedAdminRole(role.code),
    );
    const otherActiveProtectedAdministrators =
      currentTarget.status === UserStatus.ACTIVE && targetHasProtectedRole
        ? await transaction.user.count({
            where: {
              businessId: context.business.id,
              id: { not: currentTarget.id },
              status: UserStatus.ACTIVE,
              archivedAt: null,
              roles: {
                some: {
                  role: {
                    code: { in: ["SUPER_ADMIN", "OWNER"] },
                    archivedAt: null,
                  },
                },
              },
            },
          })
        : 1;
    assertLastAdministratorPreserved({
      targetIsActive: currentTarget.status === UserStatus.ACTIVE,
      targetHasProtectedRole,
      nextIsActive: input.status === UserStatus.ACTIVE,
      nextHasProtectedRole,
      otherActiveProtectedAdministrators,
    });

    await transaction.user.update({
      where: { id: currentTarget.id },
      data: {
        defaultLocationId: input.defaultLocationId,
        displayName: input.displayName,
        email: input.email,
        username: input.username,
        phone: input.phone || null,
        status: input.status,
        roles: {
          deleteMany: {},
          create: input.roleIds.map((roleId) => ({
            businessId: context.business.id,
            roleId,
          })),
        },
        locations: {
          deleteMany: {},
          create: input.locationIds.map((locationId) => ({
            businessId: context.business.id,
            locationId,
          })),
        },
      },
    });
    const revoked =
      input.status === UserStatus.ACTIVE
        ? { count: 0 }
        : await transaction.session.updateMany({
            where: { userId: currentTarget.id, revokedAt: null },
            data: { revokedAt: now },
          });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action:
        input.status === UserStatus.DISABLED &&
        currentTarget.status !== UserStatus.DISABLED
          ? AuditAction.USER_DISABLED
          : AuditAction.USER_UPDATED,
      entityType: "User",
      entityId: currentTarget.id,
      before: {
        displayName: currentTarget.displayName,
        email: currentTarget.email,
        username: currentTarget.username,
        phone: currentTarget.phone,
        status: currentTarget.status,
        roleIds: currentTarget.roles.map(({ roleId }) => roleId),
        locationIds: currentTarget.locations.map(
          ({ locationId }) => locationId,
        ),
        defaultLocationId: currentTarget.defaultLocationId,
      },
      after: {
        displayName: input.displayName,
        email: input.email,
        username: input.username,
        phone: input.phone || null,
        status: input.status,
        roleIds: input.roleIds,
        locationIds: input.locationIds,
        defaultLocationId: input.defaultLocationId,
        revokedSessionCount: revoked.count,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function resetManagedUserPassword(
  context: AuthContext,
  input: ResetPasswordInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertAdministrationPermission(context, "user.manage");
  const target = await db.user.findFirst({
    where: {
      id: input.userId,
      businessId: context.business.id,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (target === null) {
    throw new Error("User not found");
  }
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: target.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    const revoked = await transaction.session.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.USER_PASSWORD_RESET,
      entityType: "User",
      entityId: target.id,
      metadata: { revokedSessionCount: revoked.count },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

async function resolvePermissions(
  businessId: string,
  permissionIds: readonly string[],
) {
  const permissions = await db.permission.findMany({
    where: { id: { in: [...permissionIds] }, businessId },
    select: { id: true, key: true },
  });
  if (permissions.length !== new Set(permissionIds).size) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "One or more selected permissions are unavailable.",
    );
  }
  return permissions;
}

function assertSensitivePermissionConfirmation(
  requestedKeys: readonly string[],
  existingKeys: ReadonlySet<string>,
  confirmed: boolean,
): void {
  const grantsDangerousPermission = requestedKeys.some(
    (key) =>
      DANGEROUS_PERMISSION_KEYS.some((dangerous) => dangerous === key) &&
      !existingKeys.has(key),
  );
  if (grantsDangerousPermission && !confirmed) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "Confirm the sensitive permission grant before saving this role.",
    );
  }
}

export async function createManagedRole(
  context: AuthContext,
  input: CreateRoleInput,
  metadata: RequestMetadata,
): Promise<string> {
  assertAdministrationPermission(context, "role.manage");
  const permissions = await resolvePermissions(
    context.business.id,
    input.permissionIds,
  );
  const permissionKeys = permissions.map(({ key }) => key);
  assertAssignablePermissions({
    actorPermissions: context.permissions,
    requestedPermissions: permissionKeys,
    unrestricted: isUnrestricted(context),
  });
  assertSensitivePermissionConfirmation(
    permissionKeys,
    new Set(),
    input.confirmSensitivePermissions,
  );

  const baseCode = roleCodeFromName(input.name);
  const existing = await db.role.findUnique({
    where: {
      businessId_code: { businessId: context.business.id, code: baseCode },
    },
    select: { id: true },
  });
  const code =
    existing === null
      ? baseCode
      : `${baseCode.slice(0, 55)}_${randomBytes(4).toString("hex").toUpperCase()}`;

  return db.$transaction(async (transaction) => {
    const role = await transaction.role.create({
      data: {
        businessId: context.business.id,
        code,
        name: input.name,
        description: input.description || null,
        isSystem: false,
        permissions: {
          create: permissions.map(({ id }) => ({
            businessId: context.business.id,
            permissionId: id,
          })),
        },
      },
      select: { id: true },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.ROLE_CREATED,
      entityType: "Role",
      entityId: role.id,
      after: { code, name: input.name, permissionKeys },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return role.id;
  });
}

export async function updateManagedRole(
  context: AuthContext,
  input: UpdateRoleInput,
  metadata: RequestMetadata,
): Promise<void> {
  assertAdministrationPermission(context, "role.manage");
  const [role, permissions] = await Promise.all([
    db.role.findFirst({
      where: {
        id: input.roleId,
        businessId: context.business.id,
        archivedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: { permissionId: true, permission: { select: { key: true } } },
        },
      },
    }),
    resolvePermissions(context.business.id, input.permissionIds),
  ]);
  if (role === null) {
    throw new Error("Role not found");
  }
  const permissionKeys = permissions.map(({ key }) => key);
  const existingKeys = new Set(
    role.permissions.map(({ permission }) => permission.key),
  );
  assertAssignablePermissions({
    actorPermissions: context.permissions,
    requestedPermissions: permissionKeys.filter(
      (key) => !existingKeys.has(key),
    ),
    unrestricted: isUnrestricted(context),
  });
  assertSensitivePermissionConfirmation(
    permissionKeys,
    existingKeys,
    input.confirmSensitivePermissions,
  );
  if (
    role.isSystem &&
    isProtectedAdminRole(role.code) &&
    !["user.manage", "role.manage", "role.manage.unrestricted"].every((key) =>
      permissionKeys.includes(key),
    )
  ) {
    throw new AdministrationPolicyError(
      "LAST_ADMIN",
      "Protected system roles must retain user and unrestricted role management permissions.",
    );
  }

  await db.$transaction(async (transaction) => {
    await transaction.role.update({
      where: { id: role.id },
      data: {
        name: input.name,
        description: input.description || null,
        permissions: {
          deleteMany: {},
          create: permissions.map(({ id }) => ({
            businessId: context.business.id,
            permissionId: id,
          })),
        },
      },
    });
    const permissionsChanged =
      existingKeys.size !== permissionKeys.length ||
      permissionKeys.some((key) => !existingKeys.has(key));
    const roleFieldsChanged =
      role.name !== input.name ||
      (role.description ?? "") !== (input.description ?? "");
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action:
        permissionsChanged && !roleFieldsChanged
          ? AuditAction.ROLE_PERMISSIONS_CHANGED
          : AuditAction.ROLE_UPDATED,
      entityType: "Role",
      entityId: role.id,
      before: {
        code: role.code,
        name: role.name,
        description: role.description,
        permissionKeys: [...existingKeys],
      },
      after: {
        code: role.code,
        name: input.name,
        description: input.description || null,
        permissionKeys,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    if (permissionsChanged && roleFieldsChanged) {
      await writeAuditLog(transaction, {
        businessId: context.business.id,
        locationId: context.currentLocation?.id ?? null,
        actorUserId: context.user.id,
        action: AuditAction.ROLE_PERMISSIONS_CHANGED,
        entityType: "Role",
        entityId: role.id,
        before: { permissionKeys: [...existingKeys] },
        after: { permissionKeys },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    }
  });
}

export async function revokeManagedSession(
  context: AuthContext,
  userId: string,
  sessionId: string,
  metadata: RequestMetadata,
): Promise<void> {
  assertAdministrationPermission(context, "user.manage");
  const session = await db.session.findFirst({
    where: { id: sessionId, userId, businessId: context.business.id },
    select: { id: true, revokedAt: true },
  });
  if (session === null) {
    throw new Error("Session not found");
  }
  await db.$transaction(async (transaction) => {
    if (session.revokedAt === null) {
      await transaction.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.SESSION_REVOKED,
      entityType: "Session",
      entityId: session.id,
      metadata: { targetUserId: userId },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
  });
}

export async function revokeManagedOtherSessions(
  context: AuthContext,
  userId: string,
  metadata: RequestMetadata,
): Promise<number> {
  assertAdministrationPermission(context, "user.manage");
  const target = await db.user.findFirst({
    where: { id: userId, businessId: context.business.id, archivedAt: null },
    select: { id: true },
  });
  if (target === null) {
    throw new Error("User not found");
  }
  return db.$transaction(async (transaction) => {
    const revoked = await transaction.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(userId === context.user.id
          ? { id: { not: context.sessionId } }
          : {}),
      },
      data: { revokedAt: new Date() },
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.SESSION_REVOKED,
      entityType: "UserSessions",
      entityId: userId,
      metadata: { revokedSessionCount: revoked.count },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return revoked.count;
  });
}
