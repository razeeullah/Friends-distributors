import { describe, expect, it } from "vitest";

import {
  hasAnyPermission,
  hasLocationAccess,
  hasPermission,
  hasRole,
  type AuthorizationSubject,
} from "@/features/auth/authorization";

const subject = {
  permissions: new Set(["dashboard.view", "sale.create"]),
  roleCodes: ["CASHIER", "INVENTORY_STAFF"],
  locations: [{ id: "location-main" }, { id: "location-warehouse" }],
} satisfies AuthorizationSubject;

describe("authorization policies", () => {
  it("allows an effective permission inherited from any role", () => {
    expect(hasPermission(subject, "sale.create")).toBe(true);
    expect(hasAnyPermission(subject, ["report.profit", "dashboard.view"])).toBe(
      true,
    );
  });

  it("denies a missing permission", () => {
    expect(hasPermission(subject, "user.manage")).toBe(false);
    expect(hasAnyPermission(subject, ["audit.view", "role.manage"])).toBe(
      false,
    );
  });

  it("supports multiple roles", () => {
    expect(hasRole(subject, "CASHIER")).toBe(true);
    expect(hasRole(subject, "INVENTORY_STAFF")).toBe(true);
    expect(hasRole(subject, "OWNER")).toBe(false);
  });

  it("denies access to an unassigned location", () => {
    expect(hasLocationAccess(subject, "location-main")).toBe(true);
    expect(hasLocationAccess(subject, "location-other")).toBe(false);
  });
});
