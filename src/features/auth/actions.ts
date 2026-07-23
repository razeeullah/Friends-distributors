"use server";

import { redirect } from "next/navigation";

import { writeAuditLog } from "@/features/audit/write-audit-log";
import {
  authenticateCredentials,
  revokeSessionByRawToken,
} from "@/features/auth/authentication";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import { getRequestMetadata } from "@/features/auth/request-metadata";
import {
  changePasswordSchema,
  loginSchema,
  type ChangePasswordActionResult,
  type ChangePasswordInput,
  type LoginActionResult,
  type LoginInput,
} from "@/features/auth/schemas";
import {
  clearSessionCookie,
  createRawSessionToken,
  createSessionRecord,
  getCurrentRawSessionToken,
  hashSessionToken,
  requireUser,
  setSessionCookie,
} from "@/features/auth/session";
import { AuditAction } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export async function loginAction(
  input: LoginInput,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const fieldErrors = {
      ...(flattened.fieldErrors.credential === undefined
        ? {}
        : { credential: flattened.fieldErrors.credential }),
      ...(flattened.fieldErrors.password === undefined
        ? {}
        : { password: flattened.fieldErrors.password }),
    };
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors,
    };
  }

  const result = await authenticateCredentials(
    parsed.data,
    await getRequestMetadata(),
  );
  if (!result.success) {
    return result;
  }

  await setSessionCookie(result.rawToken, result.expiresAt);
  return { success: true };
}

export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ChangePasswordActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        ...(fields.currentPassword === undefined
          ? {}
          : { currentPassword: fields.currentPassword }),
        ...(fields.newPassword === undefined
          ? {}
          : { newPassword: fields.newPassword }),
        ...(fields.confirmPassword === undefined
          ? {}
          : { confirmPassword: fields.confirmPassword }),
      },
    };
  }

  const context = await requireUser();
  const user = await db.user.findUnique({
    where: { id: context.user.id },
    select: { passwordHash: true },
  });
  if (
    user === null ||
    !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))
  ) {
    return {
      success: false,
      message: "The current password is incorrect.",
      fieldErrors: {
        currentPassword: ["The current password is incorrect"],
      },
    };
  }

  const [newPasswordHash, metadata] = await Promise.all([
    hashPassword(parsed.data.newPassword),
    getRequestMetadata(),
  ]);
  const rawToken = createRawSessionToken();
  const now = new Date();
  const rotatedSession = await db.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: context.user.id },
      data: {
        passwordHash: newPasswordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    const revoked = await transaction.session.updateMany({
      where: { userId: context.user.id, revokedAt: null },
      data: { revokedAt: now },
    });
    const session = await createSessionRecord(transaction, {
      businessId: context.business.id,
      userId: context.user.id,
      currentLocationId: context.currentLocation?.id ?? null,
      tokenHash: hashSessionToken(rawToken),
      rememberMe: context.rememberMe,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    await writeAuditLog(transaction, {
      businessId: context.business.id,
      locationId: context.currentLocation?.id ?? null,
      actorUserId: context.user.id,
      action: AuditAction.AUTH_PASSWORD_CHANGED,
      entityType: "User",
      entityId: context.user.id,
      metadata: { revokedSessionCount: revoked.count },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    });
    return session;
  });

  await setSessionCookie(rawToken, rotatedSession.expiresAt);
  return {
    success: true,
    message: "Password changed. Other sessions have been signed out.",
  };
}

export async function logoutAction(): Promise<never> {
  const rawToken = await getCurrentRawSessionToken();
  if (rawToken !== null) {
    await revokeSessionByRawToken(rawToken, await getRequestMetadata());
  }
  await clearSessionCookie();
  redirect("/login");
}
