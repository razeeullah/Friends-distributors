import { describe, expect, it } from "vitest";
import { z } from "zod";

import { actionFailure, actionSuccess } from "@/lib/server/action-result";
import { ApplicationError, normalizeError } from "@/lib/server/errors";
import { flattenFieldErrors } from "@/lib/validation";

describe("server response helpers", () => {
  it("creates discriminated action results", () => {
    expect(actionSuccess({ id: "record-1" })).toEqual({
      ok: true,
      data: { id: "record-1" },
    });
    expect(actionFailure("CONFLICT", "Record already exists")).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: "Record already exists" },
    });
  });

  it("normalizes exposed application errors", () => {
    expect(
      normalizeError(
        new ApplicationError("NOT_FOUND", "Record was not found", {
          status: 404,
        }),
      ),
    ).toEqual({
      code: "NOT_FOUND",
      message: "Record was not found",
      status: 404,
    });
  });

  it("does not leak unexpected errors", () => {
    expect(normalizeError(new Error("database credentials"))).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      status: 500,
    });
  });

  it("flattens Zod issues for form fields", () => {
    const result = z
      .object({ email: z.email(), name: z.string().min(2) })
      .safeParse({ email: "invalid", name: "" });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected schema validation to fail");
    }

    expect(flattenFieldErrors(result.error)).toMatchObject({
      email: expect.any(Array),
      name: expect.any(Array),
    });
  });
});
