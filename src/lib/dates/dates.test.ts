import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  formatKarachiDate,
  toKarachiDateKey,
} from "@/lib/dates";

describe("Karachi date helpers", () => {
  it("uses the application locale and timezone defaults", () => {
    expect(DEFAULT_LOCALE).toBe("en-PK");
    expect(DEFAULT_TIMEZONE).toBe("Asia/Karachi");
  });

  it("handles the Karachi calendar-day boundary", () => {
    expect(toKarachiDateKey("2026-07-20T20:30:00.000Z")).toBe("2026-07-21");
  });

  it("rejects invalid dates", () => {
    expect(() => formatKarachiDate("not-a-date")).toThrow(RangeError);
  });
});
