import type { PermissionKey } from "@/features/auth/permissions";

export const PROTECTED_ADMIN_ROLE_CODES = ["SUPER_ADMIN", "OWNER"] as const;

export const DANGEROUS_PERMISSION_KEYS = [
  "report.profit",
  "sale.void",
  "sale.refund",
  "user.manage",
  "role.manage",
  "role.manage.unrestricted",
  "settings.manage",
] as const satisfies readonly PermissionKey[];

export class AdministrationPolicyError extends Error {
  readonly code:
    "PRIVILEGE_ESCALATION" | "LAST_ADMIN" | "SYSTEM_ROLE_IDENTIFIER";

  constructor(
    code: "PRIVILEGE_ESCALATION" | "LAST_ADMIN" | "SYSTEM_ROLE_IDENTIFIER",
    message: string,
  ) {
    super(message);
    this.name = "AdministrationPolicyError";
    this.code = code;
  }
}

export function assertAssignablePermissions(
  input: Readonly<{
    actorPermissions: ReadonlySet<string>;
    requestedPermissions: readonly string[];
    unrestricted: boolean;
  }>,
): void {
  if (input.unrestricted) {
    return;
  }

  const forbidden = input.requestedPermissions.filter(
    (permission) => !input.actorPermissions.has(permission),
  );
  if (forbidden.length > 0) {
    throw new AdministrationPolicyError(
      "PRIVILEGE_ESCALATION",
      "You cannot grant roles or permissions beyond your own effective access.",
    );
  }
}

export function assertLastAdministratorPreserved(
  input: Readonly<{
    targetIsActive: boolean;
    targetHasProtectedRole: boolean;
    nextIsActive: boolean;
    nextHasProtectedRole: boolean;
    otherActiveProtectedAdministrators: number;
  }>,
): void {
  const removesProtectedAccess =
    input.targetIsActive &&
    input.targetHasProtectedRole &&
    (!input.nextIsActive || !input.nextHasProtectedRole);

  if (removesProtectedAccess && input.otherActiveProtectedAdministrators < 1) {
    throw new AdministrationPolicyError(
      "LAST_ADMIN",
      "The last active SUPER_ADMIN or OWNER cannot be disabled or stripped of protected access.",
    );
  }
}

export function assertSystemRoleIdentifierUnchanged(
  input: Readonly<{
    isSystem: boolean;
    currentCode: string;
    requestedCode: string;
  }>,
): void {
  if (input.isSystem && input.currentCode !== input.requestedCode) {
    throw new AdministrationPolicyError(
      "SYSTEM_ROLE_IDENTIFIER",
      "System role identifiers cannot be changed.",
    );
  }
}

export function isProtectedAdminRole(code: string): boolean {
  return PROTECTED_ADMIN_ROLE_CODES.some(
    (protectedCode) => protectedCode === code,
  );
}
