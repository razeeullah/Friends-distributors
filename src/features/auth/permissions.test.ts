import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROLE_PERMISSIONS,
  isPermissionKey,
  PERMISSION_DEFINITIONS,
} from "@/features/auth/permissions";

describe("default permissions", () => {
  it("contains unique permission keys", () => {
    const keys = PERMISSION_DEFINITIONS.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only assigns registered permissions", () => {
    for (const permissions of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      expect(permissions.every(isPermissionKey)).toBe(true);
    }
  });

  it("keeps cashier permissions least-privileged", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.CASHIER).toContain("sale.create");
    expect(DEFAULT_ROLE_PERMISSIONS.CASHIER).not.toContain("sale.void");
    expect(DEFAULT_ROLE_PERMISSIONS.CASHIER).not.toContain("role.manage");
  });
});
