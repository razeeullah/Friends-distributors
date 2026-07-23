"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRoleAction, updateRoleAction } from "@/features/users/actions";
import { DANGEROUS_PERMISSION_KEYS } from "@/features/users/administration-policy";
import {
  type AdministrationActionResult,
  createRoleSchema,
  updateRoleSchema,
} from "@/features/users/schemas";

interface RoleFormValues {
  name: string;
  description: string;
  permissionIds: string[];
  confirmSensitivePermissions: boolean;
}

interface PermissionOption {
  id: string;
  key: string;
  description: string | null;
}

export function RoleForm({
  mode,
  role,
  permissions,
}: Readonly<{
  mode: "create" | "edit";
  role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissionIds: readonly string[];
  } | null;
  permissions: readonly PermissionOption[];
}>) {
  const router = useRouter();
  const initialPermissionIds = useMemo(
    () => new Set(role?.permissionIds ?? []),
    [role?.permissionIds],
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissionIds: [...(role?.permissionIds ?? [])],
      confirmSensitivePermissions: false,
    },
  });
  const selectedIds = useWatch({ control, name: "permissionIds" }) ?? [];
  const groups = useMemo(() => {
    const grouped = new Map<string, PermissionOption[]>();
    for (const permission of permissions) {
      const moduleName = permission.key.split(".")[0] ?? "system";
      grouped.set(moduleName, [...(grouped.get(moduleName) ?? []), permission]);
    }
    return [...grouped.entries()];
  }, [permissions]);
  const newlySelectedDangerous = permissions.filter(
    (permission) =>
      selectedIds.includes(permission.id) &&
      !initialPermissionIds.has(permission.id) &&
      DANGEROUS_PERMISSION_KEYS.some((key) => key === permission.key),
  );

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    const payload = mode === "edit" ? { ...values, roleId: role?.id } : values;
    const candidate =
      mode === "edit"
        ? updateRoleSchema.safeParse(payload)
        : createRoleSchema.safeParse(payload);
    if (!candidate.success) {
      for (const issue of candidate.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field in values) {
          setError(field as keyof RoleFormValues, { message: issue.message });
        }
      }
      setMessage({ type: "error", text: "Check the highlighted fields." });
      return;
    }
    let result: AdministrationActionResult;
    if (mode === "edit") {
      result = await updateRoleAction(updateRoleSchema.parse(payload));
    } else {
      result = await createRoleAction(createRoleSchema.parse(payload));
    }
    if (!result.success) {
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
      {role?.isSystem ? (
        <Alert>
          <AlertTitle>System role</AlertTitle>
          <AlertDescription>
            Identifier <strong>{role.code}</strong> is immutable. Name and
            permissions may be managed subject to privilege boundaries.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role-name">Role name</Label>
          <Input
            id="role-name"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
          {errors.name?.message ? (
            <FieldError>{errors.name.message}</FieldError>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-description">Description</Label>
          <Input
            id="role-description"
            aria-invalid={Boolean(errors.description)}
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldError>{errors.description.message}</FieldError>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Permissions</h2>
          <p className="text-muted-foreground text-sm">
            Permissions are grouped by module and enforced by the server.
          </p>
        </div>
        {groups.map(([moduleName, modulePermissions]) => {
          const allSelected = modulePermissions.every(({ id }) =>
            selectedIds.includes(id),
          );
          return (
            <fieldset key={moduleName} className="rounded-lg border p-4">
              <legend className="px-1 font-semibold capitalize">
                {moduleName}
              </legend>
              <div className="mb-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const moduleIds = new Set(
                      modulePermissions.map(({ id }) => id),
                    );
                    const next = allSelected
                      ? selectedIds.filter((id) => !moduleIds.has(id))
                      : [...new Set([...selectedIds, ...moduleIds])];
                    setValue("permissionIds", next, { shouldDirty: true });
                  }}
                >
                  {allSelected ? "Clear module" : "Select all in module"}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {modulePermissions.map((permission) => {
                  const dangerous = DANGEROUS_PERMISSION_KEYS.some(
                    (key) => key === permission.key,
                  );
                  return (
                    <label
                      key={permission.id}
                      className="flex items-start gap-3 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        value={permission.id}
                        {...register("permissionIds")}
                        className="mt-0.5 size-4"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {permission.key}
                          {dangerous ? (
                            <Badge variant="destructive">Sensitive</Badge>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs">
                          {permission.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {newlySelectedDangerous.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>Confirm sensitive permission grant</AlertTitle>
          <AlertDescription>
            <p>{newlySelectedDangerous.map(({ key }) => key).join(", ")}</p>
            <label className="mt-2 flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                {...register("confirmSensitivePermissions")}
                className="size-4"
              />
              I understand the access this grants.
            </label>
          </AlertDescription>
        </Alert>
      ) : null}

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
              ? "Create role"
              : "Save role"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="text-destructive text-xs" role="alert">
      {children}
    </p>
  );
}
