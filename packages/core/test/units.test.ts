import { describe, expect, test } from "vitest";
import { formatUnits } from "../src/domain/units";

describe("formatUnits", () => {
  test("formats 18-decimal amounts with vi-VN separators", () => {
    expect(formatUnits(1_500_000_000_000_000_000n, 18)).toBe("1,5");
    expect(formatUnits(1_234_567n * 10n ** 18n, 18)).toBe("1.234.567");
  });

  test("truncates (never rounds up) to maxFraction digits", () => {
    expect(formatUnits(123_456_789n, 8, 4)).toBe("1,2345");
  });

  test("shows a floor marker for dust below the displayed precision", () => {
    expect(formatUnits(1n, 18, 6)).toBe("<0,000001");
  });

  test("zero", () => {
    expect(formatUnits(0n, 18)).toBe("0");
  });

  test("rejects negative decimals", () => {
    expect(() => formatUnits(1n, -1)).toThrow();
  });
});

describe("formatUnits edge cases", () => {
  test("negative amounts keep their sign", () => {
    expect(formatUnits(-2_500_000n, 6)).toBe("-2,5");
  });

  test("rejects fractional decimals", () => {
    expect(() => formatUnits(1n, 1.5)).toThrow("Invalid decimals");
  });
});
