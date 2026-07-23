"use server";

import { revalidatePath } from "next/cache";

import { getRequestMetadata } from "@/features/auth/request-metadata";
import { requirePermission } from "@/features/auth/session";
import { AdministrationPolicyError } from "@/features/users/administration-policy";
import {
  createRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  sessionMutationSchema,
  type AdministrationActionResult,
  type CreateRoleInput,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateRoleInput,
  type UpdateUserInput,
  updateRoleSchema,
  updateUserSchema,
} from "@/features/users/schemas";
import {
  createManagedRole,
  createManagedUser,
  resetManagedUserPassword,
  revokeManagedOtherSessions,
  revokeManagedSession,
  updateManagedRole,
  updateManagedUser,
} from "@/features/users/services";
import { Prisma } from "@/generated/prisma/client";

function validationFailure(error: {
  flatten(): { fieldErrors: Record<string, string[] | undefined> };
}): AdministrationActionResult {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => entry[1] !== undefined,
    ),
  );
  return {
    success: false,
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

function actionFailure(error: unknown): AdministrationActionResult {
  if (error instanceof AdministrationPolicyError) {
    return { success: false, message: error.message };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return {
      success: false,
      message: "That email, username, or role identifier is already in use.",
    };
  }
  return {
    success: false,
    message:
      error instanceof Error && error.message === "User not found"
        ? error.message
        : "The request could not be completed. Please try again.",
  };
}

export async function createUserAction(
  input: CreateUserInput,
): Promise<AdministrationActionResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("user.manage");
  try {
    const userId = await createManagedUser(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/users");
    return {
      success: true,
      message: "User created successfully.",
      redirectTo: `/users/${userId}`,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateUserAction(
  input: UpdateUserInput,
): Promise<AdministrationActionResult> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("user.manage");
  try {
    await updateManagedUser(context, parsed.data, await getRequestMetadata());
    revalidatePath("/users");
    revalidatePath(`/users/${parsed.data.userId}`);
    return {
      success: true,
      message: "User updated successfully.",
      redirectTo: `/users/${parsed.data.userId}`,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<AdministrationActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("user.manage");
  try {
    await resetManagedUserPassword(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath(`/users/${parsed.data.userId}`);
    return {
      success: true,
      message: "Password reset. All active sessions were revoked.",
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createRoleAction(
  input: CreateRoleInput,
): Promise<AdministrationActionResult> {
  const parsed = createRoleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("role.manage");
  try {
    const roleId = await createManagedRole(
      context,
      parsed.data,
      await getRequestMetadata(),
    );
    revalidatePath("/users/roles");
    return {
      success: true,
      message: "Custom role created successfully.",
      redirectTo: `/users/roles/${roleId}/edit`,
    };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateRoleAction(
  input: UpdateRoleInput,
): Promise<AdministrationActionResult> {
  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("role.manage");
  try {
    await updateManagedRole(context, parsed.data, await getRequestMetadata());
    revalidatePath("/users/roles");
    revalidatePath(`/users/roles/${parsed.data.roleId}/edit`);
    return { success: true, message: "Role updated successfully." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function revokeSessionAction(input: {
  userId: string;
  sessionId: string;
}): Promise<AdministrationActionResult> {
  const parsed = sessionMutationSchema.safeParse(input);
  if (!parsed.success || parsed.data.sessionId === undefined) {
    return { success: false, message: "Invalid session request." };
  }
  const context = await requirePermission("user.manage");
  try {
    await revokeManagedSession(
      context,
      parsed.data.userId,
      parsed.data.sessionId,
      await getRequestMetadata(),
    );
    revalidatePath(`/users/${parsed.data.userId}/sessions`);
    return { success: true, message: "Session revoked." };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function revokeOtherSessionsAction(input: {
  userId: string;
}): Promise<AdministrationActionResult> {
  const parsed = sessionMutationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const context = await requirePermission("user.manage");
  try {
    const count = await revokeManagedOtherSessions(
      context,
      parsed.data.userId,
      await getRequestMetadata(),
    );
    revalidatePath(`/users/${parsed.data.userId}/sessions`);
    return {
      success: true,
      message: `${count} session${count === 1 ? "" : "s"} revoked.`,
    };
  } catch (error) {
    return actionFailure(error);
  }
}
