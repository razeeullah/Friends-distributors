import { z } from "zod";

export const loginSchema = z.object({
  credential: z
    .string()
    .trim()
    .max(254)
    .toLowerCase()
    .refine(
      (value) =>
        z.email().safeParse(value).success ||
        /^[a-z0-9](?:[a-z0-9._-]{1,62}[a-z0-9])?$/.test(value),
      "Enter a valid email address or username",
    ),
  password: z.string().min(1, "Password is required").max(256),
  rememberMe: z.boolean().default(false),
  returnTo: z
    .string()
    .max(500)
    .refine(
      (value) => value.startsWith("/") && !value.startsWith("//"),
      "Invalid return path",
    )
    .default("/dashboard"),
});

export type LoginFormInput = z.input<typeof loginSchema>;
export type LoginInput = z.output<typeof loginSchema>;

export type LoginActionResult =
  | { success: true }
  | {
      success: false;
      message: string;
      fieldErrors?: Readonly<
        Partial<Record<"credential" | "password", string[]>>
      >;
    };

export const strongPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use no more than 128 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(256),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password must be different from the current password",
      });
    }
  });

export type ChangePasswordFormInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

export type ChangePasswordActionResult =
  | { success: true; message: string }
  | {
      success: false;
      message: string;
      fieldErrors?: Readonly<
        Partial<
          Record<
            "currentPassword" | "newPassword" | "confirmPassword",
            string[]
          >
        >
      >;
    };
