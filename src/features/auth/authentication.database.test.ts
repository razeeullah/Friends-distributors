import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "@/features/auth/password";
import {
  createRawSessionToken,
  hashSessionToken,
} from "@/features/auth/session-token";
import { UserStatus } from "@/generated/prisma/enums";

const hasDatabase =
  process.env.DATABASE_URL?.startsWith("postgresql://") ?? false;
const TEST_PASSWORD = "AuthTestPassword1!";
const TEST_EMAIL = "phase3-auth-test@demo.local";
const TEST_USERNAME = "phase3-auth-test";
const TEST_IP = `198.51.${Math.floor(Math.random() * 200) + 1}.${
  Math.floor(Math.random() * 200) + 1
}`;

describe.runIf(hasDatabase).sequential("database authentication", () => {
  let authentication: typeof import("@/features/auth/authentication");
  let session: typeof import("@/features/auth/session");
  let db: (typeof import("@/lib/db"))["db"];
  let businessId: string;
  let locationId: string;
  let userId: string;
  let passwordHash: string;

  beforeAll(async () => {
    authentication = await import("@/features/auth/authentication");
    session = await import("@/features/auth/session");
    ({ db } = await import("@/lib/db"));
    passwordHash = await hashPassword(TEST_PASSWORD);

    const business = await db.business.findUniqueOrThrow({
      where: { slug: "demo-retail-business" },
      select: { id: true },
    });
    const location = await db.location.findUniqueOrThrow({
      where: { businessId_code: { businessId: business.id, code: "MAIN" } },
      select: { id: true },
    });
    const cashierRole = await db.role.findUniqueOrThrow({
      where: { businessId_code: { businessId: business.id, code: "CASHIER" } },
      select: { id: true },
    });
    const user = await db.user.upsert({
      where: { email: TEST_EMAIL },
      update: {
        businessId: business.id,
        username: TEST_USERNAME,
        displayName: "Phase 3 Auth Test",
        passwordHash,
        status: UserStatus.ACTIVE,
        archivedAt: null,
      },
      create: {
        businessId: business.id,
        email: TEST_EMAIL,
        username: TEST_USERNAME,
        displayName: "Phase 3 Auth Test",
        passwordHash,
      },
      select: { id: true },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: cashierRole.id } },
      update: { businessId: business.id },
      create: {
        businessId: business.id,
        userId: user.id,
        roleId: cashierRole.id,
      },
    });
    await db.userLocation.upsert({
      where: {
        userId_locationId: { userId: user.id, locationId: location.id },
      },
      update: { businessId: business.id },
      create: {
        businessId: business.id,
        userId: user.id,
        locationId: location.id,
      },
    });

    businessId = business.id;
    locationId = location.id;
    userId = user.id;
  });

  beforeEach(async () => {
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        archivedAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  it("creates a hashed database session for a correct username login", async () => {
    const result = await authentication.authenticateCredentials(
      {
        credential: TEST_USERNAME,
        password: TEST_PASSWORD,
        rememberMe: true,
        returnTo: "/dashboard",
      },
      { ipAddress: TEST_IP, userAgent: "vitest-auth-agent" },
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected authentication to succeed");
    const stored = await db.session.findUniqueOrThrow({
      where: { id: result.sessionId },
      select: {
        tokenHash: true,
        rememberMe: true,
        currentLocationId: true,
      },
    });
    expect(stored.tokenHash).toBe(hashSessionToken(result.rawToken));
    expect(stored.tokenHash).not.toBe(result.rawToken);
    expect(stored.rememberMe).toBe(true);
    expect(stored.currentLocationId).toBe(locationId);

    const attempt = await db.loginAttempt.findFirstOrThrow({
      where: { userId, succeeded: true },
      orderBy: { createdAt: "desc" },
    });
    expect(attempt.ipAddress).toBe(TEST_IP);
    expect(attempt.userAgent).toBe("vitest-auth-agent");
  });

  it("returns a generic error and tracks an invalid password", async () => {
    const result = await authentication.authenticateCredentials(
      {
        credential: TEST_EMAIL,
        password: "WrongPassword1!",
        rememberMe: false,
        returnTo: "/dashboard",
      },
      { ipAddress: TEST_IP, userAgent: "vitest-invalid-password" },
    );

    expect(result).toEqual({
      success: false,
      message: authentication.INVALID_LOGIN_MESSAGE,
    });
    const attempt = await db.loginAttempt.findFirstOrThrow({
      where: { userId, succeeded: false },
      orderBy: { createdAt: "desc" },
    });
    expect(attempt.failureReason).toBe("INVALID_CREDENTIALS");
  });

  it("blocks a disabled user immediately", async () => {
    await db.user.update({
      where: { id: userId },
      data: { status: UserStatus.DISABLED },
    });
    const result = await authentication.authenticateCredentials(
      {
        credential: TEST_EMAIL,
        password: TEST_PASSWORD,
        rememberMe: false,
        returnTo: "/dashboard",
      },
      { ipAddress: TEST_IP, userAgent: "vitest-disabled-user" },
    );

    expect(result).toEqual({
      success: false,
      message: authentication.INVALID_LOGIN_MESSAGE,
    });
    expect(await db.session.count({ where: { userId, revokedAt: null } })).toBe(
      0,
    );
  });

  it("rejects an expired session", async () => {
    const rawToken = createRawSessionToken();
    await db.session.create({
      data: {
        businessId,
        userId,
        currentLocationId: locationId,
        tokenHash: hashSessionToken(rawToken),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(session.resolveSessionToken(rawToken)).resolves.toBeNull();
  });

  it("revokes the database session on logout", async () => {
    const login = await authentication.authenticateCredentials(
      {
        credential: TEST_EMAIL,
        password: TEST_PASSWORD,
        rememberMe: false,
        returnTo: "/dashboard",
      },
      { ipAddress: TEST_IP, userAgent: "vitest-logout" },
    );
    if (!login.success) throw new Error("Expected authentication to succeed");

    await expect(
      authentication.revokeSessionByRawToken(login.rawToken, {
        ipAddress: TEST_IP,
        userAgent: "vitest-logout",
      }),
    ).resolves.toBe(true);
    await expect(
      session.resolveSessionToken(login.rawToken),
    ).resolves.toBeNull();
    const stored = await db.session.findUniqueOrThrow({
      where: { id: login.sessionId },
      select: { revokedAt: true },
    });
    expect(stored.revokedAt).not.toBeNull();
  });
});
