import { describe, expect, test } from "vitest";
import { pricePrecisionFor } from "@/lib/chart/precision";

describe("pricePrecisionFor", () => {
  test("cents from $1, four significant digits below, bounded", () => {
    expect(pricePrecisionFor(83_500)).toBe(2);
    expect(pricePrecisionFor(1)).toBe(2);
    expect(pricePrecisionFor(0.5)).toBe(4); // 0,5000
    expect(pricePrecisionFor(0.09378)).toBe(5); // 0,09378
    expect(pricePrecisionFor(0.000004343)).toBe(9); // 0,000004343
    expect(pricePrecisionFor(1e-15)).toBe(10);
    expect(pricePrecisionFor(0)).toBe(2);
    expect(pricePrecisionFor(Number.NaN)).toBe(2);
  });
});
