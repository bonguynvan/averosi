import { describe, expect, test } from "vitest";
import { freshness, sourced } from "../src/domain/sourced";

const NOW = new Date("2026-10-01T00:10:00Z");

describe("sourced", () => {
  test("wraps data with source and fetchedAt", () => {
    const fetchedAt = new Date("2026-10-01T00:00:00Z");
    expect(sourced(42, "CoinGecko", fetchedAt)).toEqual({ data: 42, source: "CoinGecko", fetchedAt });
  });

  test("rejects an empty source name", () => {
    expect(() => sourced(1, " ", NOW)).toThrow("source is required");
  });
});

describe("freshness", () => {
  test("fresh when younger than maxAge", () => {
    const value = sourced(1, "SBV", new Date("2026-10-01T00:09:30Z"));
    expect(freshness(value, 60_000, NOW)).toBe("fresh");
  });

  test("stale when older than maxAge", () => {
    const value = sourced(1, "SBV", new Date("2026-10-01T00:00:00Z"));
    expect(freshness(value, 60_000, NOW)).toBe("stale");
  });

  test("treats future timestamps (clock skew) as fresh", () => {
    const value = sourced(1, "SBV", new Date("2026-10-01T00:11:00Z"));
    expect(freshness(value, 60_000, NOW)).toBe("fresh");
  });
});
