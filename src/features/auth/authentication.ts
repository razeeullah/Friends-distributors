import { writeAuditLog } from "@/features/audit/write-audit-log";
import { getNextLoginFailureState } from "@/features/auth/lockout";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/features/auth/password";
import type { RequestMetadata } from "@/features/auth/request-metadata";
import type { LoginInput } from "@/features/auth/schemas";
import {
  createRawSessionToken,
  createSessionRecord,
  hashSessionToken,
} from "@/features/auth/session";
import { LoginFailureReason, UserStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";

export const INVALID_LOGIN_MESSAGE =
  "The email, username, or password is incorrect.";
export const IP_ATTEMPT_WINDOW_MINUTES = 15;
export const MAX_FAILED_ATTEMPTS_PER_IP = 25;

export type AuthenticationResult =
  | {
      success: true;
      rawToken: string;
      sessionId: string;
      expiresAt: Date;
    }
  | { success: false; message: string };

export async function authenticateCredentials(
  input: LoginInput,
  metadata: RequestMetadata,
  now = new Date(),
): Promise<AuthenticationResult> {
  const ipWindowStart = new Date(
    now.getTime() - IP_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  );

  if (metadata.ipAddress !== null) {
    const recentIpFailures = await db.loginAttempt.count({
      where: {
        ipAddress: metadata.ipAddress,
        succeeded: false,
        createdAt: { gte: ipWindowStart },
      },
    });
    if (recentIpFailures >= MAX_FAILED_ATTEMPTS_PER_IP) {
      return {
        success: false,
        message: "Too many login attempts. Wait a few minutes and try again.",
      };
    }
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ email: input.credential }, { username: input.credential }],
    },
    select: {
      id: true,
      businessId: true,
      email: true,
      passwordHash: true,
      status: true,
      archivedAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      defaultLocationId: true,
      locations: {
        where: { location: { isActive: true, archivedAt: null } },
        orderBy: { assignedAt: "asc" },
        select: { locationId: true },
      },
    },
  });

  if (user === null) {
    await verifyPassword(DUMMY_PASSWORD_HASH, input.password);
    await db.loginAttempt.create({
      data: {
        emailNormalized: input.credential,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        succeeded: false,
        failureReason: LoginFailureReason.INVALID_CREDENTIALS,
      },
    });
    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  if (user.lockedUntil !== null && user.lockedUntil > now) {
    await db.$transaction(async (transaction) => {
      await transaction.loginAttempt.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          emailNormalized: input.credential,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          succeeded: false,
          failureReason: LoginFailureReason.USER_LOCKED,
        },
      });
      await writeAuditLog(transaction, {
        businessId: user.businessId,
        actorUserId: user.id,
        action: "AUTH_LOGIN_BLOCKED",
        entityType: "User",
        entityId: user.id,
        metadata: { reason: "USER_LOCKED" },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    });
    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  const passwordIsValid = await verifyPassword(
    user.passwordHash,
    input.password,
  );
  if (!passwordIsValid) {
    const { AUTH_LOCKOUT_ATTEMPTS, AUTH_LOCKOUT_MINUTES } =
      getServerEnvironment();
    const failureState = getNextLoginFailureState(
      user.failedLoginAttempts,
      now,
      AUTH_LOCKOUT_ATTEMPTS,
      AUTH_LOCKOUT_MINUTES,
    );

    await db.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failureState.failedLoginAttempts,
          lockedUntil: failureState.lockedUntil,
        },
      });
      await transaction.loginAttempt.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          emailNormalized: input.credential,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          succeeded: false,
          failureReason: LoginFailureReason.INVALID_CREDENTIALS,
        },
      });
      await writeAuditLog(transaction, {
        businessId: user.businessId,
        actorUserId: user.id,
        action: failureState.accountLocked
          ? "AUTH_ACCOUNT_LOCKED"
          : "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          failedAttempt: failureState.accountLocked
            ? AUTH_LOCKOUT_ATTEMPTS
            : failureState.failedLoginAttempts,
        },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    });
    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  if (user.status !== UserStatus.ACTIVE || user.archivedAt !== null) {
    await db.$transaction(async (transaction) => {
      await transaction.loginAttempt.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          emailNormalized: input.credential,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          succeeded: false,
          failureReason: LoginFailureReason.USER_DISABLED,
        },
      });
      await writeAuditLog(transaction, {
        businessId: user.businessId,
        actorUserId: user.id,
        action: "AUTH_LOGIN_BLOCKED",
        entityType: "User",
        entityId: user.id,
        metadata: { reason: "USER_DISABLED" },
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      });
    });
    return { success: false, message: INVALID_LOGIN_MESSAGE };
  }

  const rawToken = createRawSessionToken();
  const session = await db.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    await transaction.session.updateMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
      },
      data: { revokedAt: now },
    });
    const createdSession = await createSessionRecord(transaction, {
      businessId: user.businessId,
      userId: user.id,
      currentLocationId:
        user.locations.find(
          ({ locationId }) => locationId === user.defaultLocationId,
        )?.locationId ??
        user.locations[0]?.locationId ??
        null,
      tokenHash: hashSessionToken(rawToken),
      rememberMe: input.rememberMe,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    await transaction.loginAttempt.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        emailNormalized: input.credential,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        succeeded: true,
      },
    });
    await writeAuditLog(transaction, {
      businessId: user.businessId,
      actorUserId: user.id,
      action: "AUTH_LOGIN_SUCCEEDED",
      entityType: "Session",
      entityId: createdSession.id,
      metadata: { rememberMe: input.rememberMe },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return createdSession;
  });

  return {
    success: true,
    rawToken,
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
}

export async function revokeSessionByRawToken(
  rawToken: string,
  metadata: RequestMetadata,
  now = new Date(),
): Promise<boolean> {
  const tokenHash = hashSessionToken(rawToken);
  return db.$transaction(async (transaction) => {
    const session = await transaction.session.findUnique({
      where: { tokenHash },
      select: { id: true, user: { select: { id: true, businessId: true } } },
    });
    if (session === null) {
      return false;
    }

    await transaction.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
    await writeAuditLog(transaction, {
      businessId: session.user.businessId,
      actorUserId: session.user.id,
      action: "AUTH_LOGOUT",
      entityType: "Session",
      entityId: session.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return true;
  });
}
