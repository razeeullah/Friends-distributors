import { z } from "zod";

import { strongPasswordSchema } from "@/features/auth/schemas";

const uuidSchema = z.uuid();
const roleIdsSchema = z.array(uuidSchema).min(1, "Assign at least one role");
const locationIdsSchema = z
  .array(uuidSchema)
  .min(1, "Assign at least one location");

const userBaseSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    email: z.email().trim().toLowerCase().max(254),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(64)
      .regex(
        /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/,
        "Use lowercase letters, numbers, dots, dashes, or underscores",
      ),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^\+?[0-9 ()-]*$/, "Enter a valid phone number")
      .optional()
      .or(z.literal("")),
    roleIds: roleIdsSchema,
    locationIds: locationIdsSchema,
    defaultLocationId: uuidSchema,
    status: z.enum(["ACTIVE", "DISABLED", "INVITED"]),
  })
  .refine((value) => value.locationIds.includes(value.defaultLocationId), {
    path: ["defaultLocationId"],
    message: "Default location must be one of the assigned locations",
  });

export const createUserSchema = userBaseSchema.extend({
  password: strongPasswordSchema,
});

export const updateUserSchema = userBaseSchema.extend({
  userId: uuidSchema,
});

export const resetPasswordSchema = z.object({
  userId: uuidSchema,
  password: strongPasswordSchema,
});

export const sessionMutationSchema = z.object({
  userId: uuidSchema,
  sessionId: uuidSchema.optional(),
});

const roleBaseSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  permissionIds: z.array(uuidSchema),
  confirmSensitivePermissions: z.boolean().default(false),
});

export const createRoleSchema = roleBaseSchema;
export const updateRoleSchema = roleBaseSchema.extend({
  roleId: uuidSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export type AdministrationActionResult =
  | { success: true; message: string; redirectTo?: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Readonly<Record<string, readonly string[]>>;
    };
