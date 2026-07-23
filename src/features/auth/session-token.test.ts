import { describe, expect, it } from "vitest";

import {
  createRawSessionToken,
  hashSessionToken,
} from "@/features/auth/session-token";

describe("session tokens", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const first = createRawSessionToken();
    const second = createRawSessionToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("stores only a deterministic SHA-256 token hash", () => {
    expect(hashSessionToken("example-token")).toBe(
      "4d1566a1d7df42a8517456d60ea06ed284e535cfe4c956aa6ee172dbcdf945f7",
    );
  });
});
