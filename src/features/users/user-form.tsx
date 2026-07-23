"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createUserAction, updateUserAction } from "@/features/users/actions";
import {
  type AdministrationActionResult,
  createUserSchema,
  updateUserSchema,
} from "@/features/users/schemas";

interface UserFormValues {
  displayName: string;
  email: string;
  username: string;
  phone: string;
  password: string;
  roleIds: string[];
  locationIds: string[];
  defaultLocationId: string;
  status: "ACTIVE" | "DISABLED" | "INVITED";
}

interface UserFormProps {
  mode: "create" | "edit";
  userId?: string;
  initialValues: UserFormValues;
  roles: readonly {
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
  }[];
  locations: readonly { id: string; code: string; name: string }[];
}

export function UserForm({
  mode,
  userId,
  initialValues,
  roles,
  locations,
}: Readonly<UserFormProps>) {
  const router = useRouter();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({ defaultValues: initialValues });
  const selectedLocations = useWatch({ control, name: "locationIds" }) ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const candidate =
      mode === "create"
        ? createUserSchema.safeParse(values)
        : updateUserSchema.safeParse({ ...values, userId });
    if (!candidate.success) {
      for (const issue of candidate.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof UserFormValues, { message: issue.message });
        }
      }
      setMessage({ type: "error", text: "Check the highlighted fields." });
      return;
    }

    let result: AdministrationActionResult;
    if (mode === "create") {
      result = await createUserAction(createUserSchema.parse(values));
    } else {
      result = await updateUserAction(
        updateUserSchema.parse({ ...values, userId }),
      );
    }
    if (!result.success) {
      if (result.fieldErrors) {
        for (const [field, fieldMessages] of Object.entries(
          result.fieldErrors,
        )) {
          if (field in values && fieldMessages[0]) {
            setError(field as keyof UserFormValues, {
              message: fieldMessages[0],
            });
          }
        }
      }
      setMessage({ type: "error", text: result.message });
      return;
    }
    setMessage({ type: "success", text: result.message });
    if (result.redirectTo) router.push(result.redirectTo);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {message ? (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {message.type === "error" ? "Unable to save" : "Saved"}
          </AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label="Full name"
          htmlFor="user-display-name"
          error={errors.displayName?.message}
        >
          <Input
            id="user-display-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            {...register("displayName")}
          />
        </FormField>
        <FormField
          label="Phone"
          htmlFor="user-phone"
          error={errors.phone?.message}
        >
          <Input
            id="user-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            {...register("phone")}
          />
        </FormField>
        <FormField
          label="Email"
          htmlFor="user-email"
          error={errors.email?.message}
        >
          <Input
            id="user-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
        </FormField>
        <FormField
          label="Username"
          htmlFor="user-username"
          error={errors.username?.message}
        >
          <Input
            id="user-username"
            autoComplete="username"
            aria-invalid={Boolean(errors.username)}
            {...register("username")}
          />
        </FormField>
        {mode === "create" ? (
          <FormField
            label="Temporary password"
            htmlFor="user-password"
            error={errors.password?.message}
          >
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
          </FormField>
        ) : null}
        <FormField
          label="Status"
          htmlFor="user-status"
          error={errors.status?.message}
        >
          <select
            id="user-status"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            {...register("status")}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="INVITED">Invited</option>
          </select>
        </FormField>
      </div>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Assigned roles</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-start gap-3 rounded-md border p-3 text-sm"
            >
              <input
                type="checkbox"
                value={role.id}
                {...register("roleIds")}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="block font-medium">{role.name}</span>
                <span className="text-muted-foreground text-xs">
                  {role.code}
                </span>
              </span>
            </label>
          ))}
        </div>
        {errors.roleIds?.message ? (
          <FieldError>{errors.roleIds.message}</FieldError>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">
          Assigned locations
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <label
              key={location.id}
              className="flex items-center gap-3 rounded-md border p-3 text-sm"
            >
              <input
                type="checkbox"
                value={location.id}
                {...register("locationIds")}
                className="size-4"
              />
              <span>
                {location.name}{" "}
                <span className="text-muted-foreground">({location.code})</span>
              </span>
            </label>
          ))}
        </div>
        {errors.locationIds?.message ? (
          <FieldError>{errors.locationIds.message}</FieldError>
        ) : null}
        <FormField
          label="Default location"
          htmlFor="user-default-location"
          error={errors.defaultLocationId?.message}
        >
          <select
            id="user-default-location"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm md:max-w-md"
            {...register("defaultLocationId")}
          >
            <option value="">Select a default location</option>
            {locations
              .filter(({ id }) => selectedLocations.includes(id))
              .map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
          </select>
        </FormField>
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving…"
            : mode === "create"
              ? "Create user"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: Readonly<{
  label: string;
  htmlFor: string;
  error: string | undefined;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-destructive text-xs" role="alert">
      {children}
    </p>
  );
}
