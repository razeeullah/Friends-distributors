"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/features/users/actions";
import { resetPasswordSchema } from "@/features/users/schemas";

export function ResetPasswordForm({ userId }: Readonly<{ userId: string }>) {
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>({ defaultValues: { password: "" } });

  return (
    <form
      className="space-y-3"
      onSubmit={handleSubmit(async ({ password }) => {
        const parsed = resetPasswordSchema.safeParse({ userId, password });
        if (!parsed.success) {
          setError("password", {
            message:
              parsed.error.issues[0]?.message ?? "Enter a valid password",
          });
          return;
        }
        const result = await resetPasswordAction(parsed.data);
        setMessage({
          type: result.success ? "success" : "error",
          text: result.message,
        });
        if (result.success) reset();
      })}
      noValidate
    >
      {message ? (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {message.type === "error" ? "Unable to reset" : "Password reset"}
          </AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="reset-password">New temporary password</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password?.message ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Resetting the password immediately revokes every active session for this
        user.
      </p>
      <Button type="submit" variant="destructive" disabled={isSubmitting}>
        {isSubmitting ? "Resetting…" : "Reset password and revoke sessions"}
      </Button>
    </form>
  );
}
