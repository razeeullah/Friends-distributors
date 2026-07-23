import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/features/auth/password";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies without exposing the password", async () => {
    const password = "a-strong-test-password";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(passwordHash, password)).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "wrong-password")).resolves.toBe(
      false,
    );
  });
});
