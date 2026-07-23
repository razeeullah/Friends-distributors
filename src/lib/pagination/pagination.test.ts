import { describe, expect, it } from "vitest";

import { createPaginationMeta, parsePagination } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("applies safe defaults", () => {
    expect(parsePagination({})).toEqual({
      page: 1,
      pageSize: 25,
      skip: 0,
      take: 25,
    });
  });

  it("coerces query-string values and computes the offset", () => {
    expect(parsePagination({ page: "3", pageSize: "20" })).toEqual({
      page: 3,
      pageSize: 20,
      skip: 40,
      take: 20,
    });
  });

  it("rejects unbounded page sizes", () => {
    expect(() => parsePagination({ pageSize: 101 })).toThrow();
  });

  it("builds navigation metadata", () => {
    expect(
      createPaginationMeta({ page: 2, pageSize: 25, totalItems: 51 }),
    ).toEqual({
      page: 2,
      pageSize: 25,
      totalItems: 51,
      totalPages: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });
});
