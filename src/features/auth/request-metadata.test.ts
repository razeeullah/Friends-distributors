import { describe, expect, it } from "vitest";

import { firstValidForwardedAddress } from "@/features/auth/request-metadata";

describe("request metadata", () => {
  it("accepts the first valid forwarded address", () => {
    expect(firstValidForwardedAddress("203.0.113.8, 10.0.0.2")).toBe(
      "203.0.113.8",
    );
    expect(firstValidForwardedAddress("2001:db8::1")).toBe("2001:db8::1");
  });

  it("rejects malformed forwarded values", () => {
    expect(firstValidForwardedAddress("not-an-ip")).toBeNull();
    expect(firstValidForwardedAddress(null)).toBeNull();
  });
});
