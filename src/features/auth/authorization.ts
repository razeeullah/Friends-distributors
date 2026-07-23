import type { PermissionKey } from "@/features/auth/permissions";

export interface AuthorizationSubject {
  permissions: ReadonlySet<string>;
  roleCodes: readonly string[];
  locations: readonly { id: string }[];
}

export class AuthorizationError extends Error {
  readonly code: "FORBIDDEN" | "LOCATION_FORBIDDEN";

  constructor(
    message = "You do not have permission to perform this action",
    code: "FORBIDDEN" | "LOCATION_FORBIDDEN" = "FORBIDDEN",
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function hasPermission(
  subject: AuthorizationSubject,
  permission: PermissionKey,
): boolean {
  return subject.permissions.has(permission);
}

export function hasAnyPermission(
  subject: AuthorizationSubject,
  permissions: readonly PermissionKey[],
): boolean {
  return permissions.some((permission) => hasPermission(subject, permission));
}

export function hasRole(
  subject: AuthorizationSubject,
  roleCode: string,
): boolean {
  return subject.roleCodes.includes(roleCode);
}

export function hasLocationAccess(
  subject: AuthorizationSubject,
  locationId: string,
): boolean {
  return subject.locations.some((location) => location.id === locationId);
}
