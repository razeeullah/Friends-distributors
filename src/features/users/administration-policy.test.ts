import { describe, expect, it } from "vitest";

import {
  AdministrationPolicyError,
  assertAssignablePermissions,
  assertLastAdministratorPreserved,
  assertSystemRoleIdentifierUnchanged,
} from "@/features/users/administration-policy";

describe("user administration privilege boundaries", () => {
  it("allows administrators to grant permissions they possess", () => {
    expect(() =>
      assertAssignablePermissions({
        actorPermissions: new Set(["user.manage", "product.view"]),
        requestedPermissions: ["product.view"],
        unrestricted: false,
      }),
    ).not.toThrow();
  });

  it("rejects assigning permissions the administrator does not possess", () => {
    expect(() =>
      assertAssignablePermissions({
        actorPermissions: new Set(["user.manage"]),
        requestedPermissions: ["role.manage"],
        unrestricted: false,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AdministrationPolicyError>>({
        code: "PRIVILEGE_ESCALATION",
      }),
    );
  });

  it("allows explicit unrestricted role managers to grant broader access", () => {
    expect(() =>
      assertAssignablePermissions({
        actorPermissions: new Set(["role.manage.unrestricted"]),
        requestedPermissions: ["settings.manage", "role.manage"],
        unrestricted: true,
      }),
    ).not.toThrow();
  });

  it("prevents disabling the last active protected administrator", () => {
    expect(() =>
      assertLastAdministratorPreserved({
        targetIsActive: true,
        targetHasProtectedRole: true,
        nextIsActive: false,
        nextHasProtectedRole: true,
        otherActiveProtectedAdministrators: 0,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AdministrationPolicyError>>({
        code: "LAST_ADMIN",
      }),
    );
  });

  it("prevents stripping the last active protected administrator role", () => {
    expect(() =>
      assertLastAdministratorPreserved({
        targetIsActive: true,
        targetHasProtectedRole: true,
        nextIsActive: true,
        nextHasProtectedRole: false,
        otherActiveProtectedAdministrators: 0,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AdministrationPolicyError>>({
        code: "LAST_ADMIN",
      }),
    );
  });

  it("allows protected access changes when another active owner or super admin remains", () => {
    expect(() =>
      assertLastAdministratorPreserved({
        targetIsActive: true,
        targetHasProtectedRole: true,
        nextIsActive: false,
        nextHasProtectedRole: false,
        otherActiveProtectedAdministrators: 1,
      }),
    ).not.toThrow();
  });

  it("rejects direct edits to system role identifiers", () => {
    expect(() =>
      assertSystemRoleIdentifierUnchanged({
        isSystem: true,
        currentCode: "OWNER",
        requestedCode: "MANAGER",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<AdministrationPolicyError>>({
        code: "SYSTEM_ROLE_IDENTIFIER",
      }),
    );
  });
});
