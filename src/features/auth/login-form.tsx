"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/features/auth/actions";
import {
  loginSchema,
  type LoginFormInput,
  type LoginInput,
} from "@/features/auth/schemas";

interface LoginFormProps {
  returnTo: string;
}

export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginFormInput, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      credential: "",
      password: "",
      rememberMe: false,
      returnTo,
    },
  });

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(() => {
      void loginAction(values)
        .then((result) => {
          if (!result.success) {
            setServerError(result.message);
            if (result.fieldErrors?.credential?.[0] !== undefined) {
              form.setError("credential", {
                message: result.fieldErrors.credential[0],
              });
            }
            if (result.fieldErrors?.password?.[0] !== undefined) {
              form.setError("password", {
                message: result.fieldErrors.password[0],
              });
            }
            return;
          }

          router.replace(values.returnTo);
          router.refresh();
        })
        .catch(() => {
          setServerError(
            "We could not sign you in right now. Please try again.",
          );
        });
    });
  });

  return (
    <form className="space-y-5" onSubmit={submit} noValidate>
      <input type="hidden" {...form.register("returnTo")} />

      {serverError !== null ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" />
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="credential">Email or username</Label>
        <Input
          id="credential"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={form.formState.errors.credential !== undefined}
          aria-describedby={
            form.formState.errors.credential === undefined
              ? undefined
              : "credential-error"
          }
          placeholder="owner@demo.local or owner"
          disabled={isPending}
          {...form.register("credential")}
        />
        {form.formState.errors.credential?.message !== undefined ? (
          <p
            id="credential-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {form.formState.errors.credential.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <input
          id="rememberMe"
          type="checkbox"
          className="border-input mt-0.5 size-4 rounded"
          disabled={isPending}
          aria-describedby="remember-me-description"
          {...form.register("rememberMe")}
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor="rememberMe">Keep me signed in</Label>
          <p
            id="remember-me-description"
            className="text-muted-foreground text-xs"
          >
            Use only on a trusted device. Remembered sessions last up to 30
            days.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <span className="text-muted-foreground text-xs">Case-sensitive</span>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={form.formState.errors.password !== undefined}
          aria-describedby={
            form.formState.errors.password === undefined
              ? undefined
              : "password-error"
          }
          disabled={isPending}
          {...form.register("password")}
        />
        {form.formState.errors.password?.message !== undefined ? (
          <p
            id="password-error"
            className="text-destructive text-sm"
            role="alert"
          >
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <Button className="w-full" size="lg" type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {isPending ? "Signing in…" : "Sign in securely"}
      </Button>
    </form>
  );
}
