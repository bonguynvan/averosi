import { describe, expect, test } from "vitest";
import { formatVnd, parseVndInput } from "../src/domain/money";

describe("parseVndInput", () => {
  test("parses plain digits", () => {
    expect(parseVndInput("1500000")).toEqual({ ok: true, value: 1_500_000n });
  });

  test("accepts vi-VN thousand separators and spaces", () => {
    expect(parseVndInput(" 1.500.000 ")).toEqual({ ok: true, value: 1_500_000n });
  });

  test("handles values beyond Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(parseVndInput("123456789012345678901")).toEqual({ ok: true, value: 123456789012345678901n });
  });

  test("rejects empty input", () => {
    expect(parseVndInput("   ")).toEqual({ ok: false, error: "EMPTY" });
  });

  test("rejects decimals, negatives and letters", () => {
    expect(parseVndInput("1,5")).toEqual({ ok: false, error: "INVALID" });
    expect(parseVndInput("-100")).toEqual({ ok: false, error: "INVALID" });
    expect(parseVndInput("12abc")).toEqual({ ok: false, error: "INVALID" });
  });
});

describe("formatVnd", () => {
  test("formats with dot thousand separators and dong sign", () => {
    expect(formatVnd(2_348_500_000n)).toBe("2.348.500.000 ₫");
  });

  test("formats zero and small values", () => {
    expect(formatVnd(0n)).toBe("0 ₫");
    expect(formatVnd(999n)).toBe("999 ₫");
  });

  test("formats negative values", () => {
    expect(formatVnd(-1_000n)).toBe("-1.000 ₫");
  });
});
