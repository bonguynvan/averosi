import { describe, expect, test } from "vitest";
import { sparklinePath } from "../src/domain/sparkline";

describe("sparklinePath", () => {
  test("scales values into the box (y inverted) and reports direction", () => {
    expect(sparklinePath([1, 3, 2], 100, 20)).toEqual({ d: "M0 20L50 0L100 10", direction: "up" });
  });

  test("flat series draws a centred line", () => {
    expect(sparklinePath([5, 5], 10, 10)).toEqual({ d: "M0 5L10 5", direction: "flat" });
  });

  test("down direction when last < first", () => {
    expect(sparklinePath([3, 1], 10, 10)?.direction).toBe("down");
  });

  test("fewer than two finite points yields null", () => {
    expect(sparklinePath([1], 10, 10)).toBeNull();
    expect(sparklinePath([Number.NaN, 2], 10, 10)).toBeNull();
  });
});
