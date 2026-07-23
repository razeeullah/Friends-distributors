"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/features/auth/actions";
import {
  changePasswordSchema,
  type ChangePasswordFormInput,
  type ChangePasswordInput,
} from "@/features/auth/schemas";

type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

const passwordFields = [
  {
    name: "currentPassword",
    label: "Current password",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    label: "New password",
    autoComplete: "new-password",
  },
  {
    name: "confirmPassword",
    label: "Confirm new password",
    autoComplete: "new-password",
  },
] as const satisfies readonly {
  name: PasswordField;
  label: string;
  autoComplete: string;
}[];

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const form = useForm<ChangePasswordFormInput, unknown, ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const submit = form.handleSubmit((values) => {
    setStatus(undefined);
    startTransition(() => {
      void changePasswordAction(values)
        .then((result) => {
          if (!result.success) {
            setStatus({ type: "error", message: result.message });
            for (const field of passwordFields) {
              const message = result.fieldErrors?.[field.name]?.[0];
              if (message !== undefined) {
                form.setError(field.name, { message });
              }
            }
            return;
          }
          form.reset();
          setStatus({ type: "success", message: result.message });
        })
        .catch(() => {
          setStatus({
            type: "error",
            message: "We could not change your password. Please try again.",
          });
        });
    });
  });

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      {status ? (
        <Alert variant={status.type === "error" ? "destructive" : "default"}>
          {status.type === "error" ? (
            <AlertCircle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          <AlertTitle>
            {status.type === "error"
              ? "Password not changed"
              : "Password changed"}
          </AlertTitle>
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      ) : null}

      {passwordFields.map((field) => {
        const error = form.formState.errors[field.name];
        const errorId = `${field.name}-error`;
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              type="password"
              autoComplete={field.autoComplete}
              disabled={isPending}
              aria-invalid={error !== undefined}
              aria-describedby={error === undefined ? undefined : errorId}
              {...form.register(field.name)}
            />
            {error?.message !== undefined ? (
              <p id={errorId} className="text-destructive text-sm" role="alert">
                {error.message}
              </p>
            ) : null}
          </div>
        );
      })}

      <p className="text-muted-foreground text-xs">
        Use at least 12 characters with uppercase, lowercase, number, and
        symbol. Changing your password signs out every other session.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
        {isPending ? "Changing password…" : "Change password"}
      </Button>
    </form>
  );
}
