import { describe, expect, it } from "vitest";

import {
  formatMoney,
  minorToDecimalString,
  parseMoneyToMinor,
  sumMoney,
} from "@/lib/money";

describe("money helpers", () => {
  it("formats PKR minor units without floating-point conversion", () => {
    expect(formatMoney(123_456n)).toBe("PKR 1,234.56");
    expect(formatMoney(-5n)).toBe("-PKR 0.05");
  });

  it("preserves integers larger than JavaScript's safe-number range", () => {
    expect(formatMoney(9_007_199_254_740_993n)).toBe(
      "PKR 90,071,992,547,409.93",
    );
  });

  it("sums money using bigint arithmetic", () => {
    expect(sumMoney([10n, 25n, -5n])).toBe(30n);
  });

  it("parses decimal strings without converting through number", () => {
    expect(parseMoneyToMinor("1234.56")).toBe(123_456n);
    expect(parseMoneyToMinor("-0.05")).toBe(-5n);
    expect(parseMoneyToMinor("9007199254740993.01")).toBe(
      900_719_925_474_099_301n,
    );
  });

  it("rejects ambiguous or over-precise money inputs", () => {
    expect(() => parseMoneyToMinor("1,234.56")).toThrow(TypeError);
    expect(() => parseMoneyToMinor("1.001")).toThrow(RangeError);
    expect(() => parseMoneyToMinor("1e3")).toThrow(TypeError);
  });

  it("serializes minor units as an exact decimal string", () => {
    expect(minorToDecimalString(123_456n)).toBe("1234.56");
    expect(minorToDecimalString(-5n)).toBe("-0.05");
  });
});
