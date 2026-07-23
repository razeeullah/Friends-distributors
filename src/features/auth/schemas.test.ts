import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/schemas";

describe("loginSchema", () => {
  it("normalizes an email and supplies a safe default return path", () => {
    const result = loginSchema.parse({
      credential: " OWNER@Example.COM ",
      password: "secret",
    });
    expect(result).toEqual({
      credential: "owner@example.com",
      password: "secret",
      rememberMe: false,
      returnTo: "/dashboard",
    });
  });

  it("accepts and normalizes a username", () => {
    expect(
      loginSchema.parse({
        credential: " Demo.Cashier ",
        password: "secret",
        rememberMe: true,
      }),
    ).toMatchObject({ credential: "demo.cashier", rememberMe: true });
  });

  it("rejects protocol-relative redirect targets", () => {
    const result = loginSchema.safeParse({
      credential: "owner@example.com",
      password: "secret",
      returnTo: "//malicious.example",
    });
    expect(result.success).toBe(false);
  });
});
