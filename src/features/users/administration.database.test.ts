import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH } from "@/features/auth/password";
import type { AuthContext } from "@/features/auth/session";
import { AdministrationPolicyError } from "@/features/users/administration-policy";
import { AuditAction, UserStatus } from "@/generated/prisma/enums";

const hasDatabase =
  process.env.DATABASE_URL?.startsWith("postgresql://") ?? false;

describe.runIf(hasDatabase).sequential("database user administration", () => {
  let db: (typeof import("@/lib/db"))["db"];
  let services: typeof import("@/features/users/services");
  let context: AuthContext;
  let ownerId: string;
  let staffId: string;
  let ownerRoleId: string;
  let staffRoleId: string;
  let locationId: string;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    services = await import("@/features/users/services");
    const business = await db.business.upsert({
      where: { slug: "phase4-administration-test" },
      update: { archivedAt: null },
      create: {
        slug: "phase4-administration-test",
        name: "Phase 4 Test Business",
      },
    });
    const location = await db.location.upsert({
      where: { businessId_code: { businessId: business.id, code: "TEST" } },
      update: { isActive: true, archivedAt: null },
      create: { businessId: business.id, code: "TEST", name: "Test Location" },
    });
    const permissionIds = new Map<string, string>();
    for (const key of [
      "user.manage",
      "role.manage",
      "role.manage.unrestricted",
    ]) {
      const permission = await db.permission.upsert({
        where: { businessId_key: { businessId: business.id, key } },
        update: {},
        create: { businessId: business.id, key, description: key },
      });
      permissionIds.set(key, permission.id);
    }
    const ownerRole = await db.role.upsert({
      where: { businessId_code: { businessId: business.id, code: "OWNER" } },
      update: { archivedAt: null, isSystem: true },
      create: {
        businessId: business.id,
        code: "OWNER",
        name: "Owner",
        isSystem: true,
      },
    });
    const staffRole = await db.role.upsert({
      where: { businessId_code: { businessId: business.id, code: "STAFF" } },
      update: { archivedAt: null },
      create: { businessId: business.id, code: "STAFF", name: "Staff" },
    });
    await db.rolePermission.deleteMany({ where: { roleId: ownerRole.id } });
    await db.rolePermission.createMany({
      data: [...permissionIds.values()].map((permissionId) => ({
        businessId: business.id,
        roleId: ownerRole.id,
        permissionId,
      })),
    });
    const owner = await db.user.upsert({
      where: { email: "phase4-owner@test.local" },
      update: {
        businessId: business.id,
        defaultLocationId: location.id,
        status: UserStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        defaultLocationId: location.id,
        email: "phase4-owner@test.local",
        username: "phase4-owner",
        displayName: "Phase 4 Owner",
        passwordHash: DUMMY_PASSWORD_HASH,
      },
    });
    const staff = await db.user.upsert({
      where: { email: "phase4-staff@test.local" },
      update: {
        businessId: business.id,
        defaultLocationId: location.id,
        status: UserStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        defaultLocationId: location.id,
        email: "phase4-staff@test.local",
        username: "phase4-staff",
        displayName: "Phase 4 Staff",
        passwordHash: DUMMY_PASSWORD_HASH,
      },
    });
    await db.userRole.deleteMany({
      where: { userId: { in: [owner.id, staff.id] } },
    });
    await db.userRole.createMany({
      data: [
        { businessId: business.id, userId: owner.id, roleId: ownerRole.id },
        { businessId: business.id, userId: staff.id, roleId: staffRole.id },
      ],
    });
    await db.userLocation.deleteMany({
      where: { userId: { in: [owner.id, staff.id] } },
    });
    await db.userLocation.createMany({
      data: [owner.id, staff.id].map((userId) => ({
        businessId: business.id,
        userId,
        locationId: location.id,
      })),
    });

    ownerId = owner.id;
    staffId = staff.id;
    ownerRoleId = ownerRole.id;
    staffRoleId = staffRole.id;
    locationId = location.id;
    context = {
      sessionId: "00000000-0000-4000-8000-000000000001",
      expiresAt: new Date(Date.now() + 60_000),
      rememberMe: false,
      user: {
        id: owner.id,
        businessId: business.id,
        email: owner.email,
        username: owner.username,
        displayName: owner.displayName,
      },
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        currencyCode: business.currencyCode,
        timezone: business.timezone,
        locale: business.locale,
      },
      roles: [{ code: "OWNER", name: "Owner" }],
      roleCodes: ["OWNER"],
      permissions: new Set([
        "user.manage",
        "role.manage",
        "role.manage.unrestricted",
      ]),
      locations: [
        { id: location.id, code: location.code, name: location.name },
      ],
      currentLocation: {
        id: location.id,
        code: location.code,
        name: location.name,
      },
    };
  });

  beforeEach(async () => {
    await db.user.updateMany({
      where: { id: { in: [ownerId, staffId] } },
      data: { status: UserStatus.ACTIVE },
    });
    await db.session.deleteMany({ where: { userId: staffId } });
  });

  it("preserves the last active OWNER at the database transaction boundary", async () => {
    await expect(
      services.updateManagedUser(
        context,
        {
          userId: ownerId,
          displayName: "Phase 4 Owner",
          email: "phase4-owner@test.local",
          username: "phase4-owner",
          phone: "",
          roleIds: [ownerRoleId],
          locationIds: [locationId],
          defaultLocationId: locationId,
          status: UserStatus.DISABLED,
        },
        { ipAddress: "192.0.2.10", userAgent: "vitest-phase4" },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<AdministrationPolicyError>>({
        code: "LAST_ADMIN",
      }),
    );
    await expect(
      db.user.findUniqueOrThrow({ where: { id: ownerId } }),
    ).resolves.toMatchObject({ status: UserStatus.ACTIVE });
  });

  it("revokes sessions and audits when a non-protected user is disabled", async () => {
    const session = await db.session.create({
      data: {
        businessId: context.business.id,
        userId: staffId,
        currentLocationId: locationId,
        tokenHash: "b".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await services.updateManagedUser(
      context,
      {
        userId: staffId,
        displayName: "Phase 4 Staff",
        email: "phase4-staff@test.local",
        username: "phase4-staff",
        phone: "",
        roleIds: [staffRoleId],
        locationIds: [locationId],
        defaultLocationId: locationId,
        status: UserStatus.DISABLED,
      },
      { ipAddress: "192.0.2.11", userAgent: "vitest-phase4" },
    );
    await expect(
      db.session.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ revokedAt: expect.any(Date) });
    await expect(
      db.auditLog.findFirstOrThrow({
        where: {
          businessId: context.business.id,
          entityId: staffId,
          action: AuditAction.USER_DISABLED,
        },
        orderBy: { createdAt: "desc" },
      }),
    ).resolves.toMatchObject({ actorUserId: ownerId });
  });
});
