import { describe, expect, it } from "vitest";

import { getNextLoginFailureState } from "@/features/auth/lockout";

describe("login lockout policy", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("increments failures below the threshold", () => {
    expect(getNextLoginFailureState(2, now, 5, 15)).toEqual({
      failedLoginAttempts: 3,
      lockedUntil: null,
      accountLocked: false,
    });
  });

  it("locks and resets the counter at the threshold", () => {
    expect(getNextLoginFailureState(4, now, 5, 15)).toEqual({
      failedLoginAttempts: 0,
      lockedUntil: new Date("2026-07-20T12:15:00.000Z"),
      accountLocked: true,
    });
  });
});
