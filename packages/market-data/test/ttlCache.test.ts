import { describe, expect, test, vi } from "vitest";
import { createTtlCache } from "../src/ttlCache";

describe("createTtlCache", () => {
  test("serves cached value within TTL, shares in-flight loads, refreshes after TTL", async () => {
    let t = 0;
    let n = 0;
    const load = vi.fn(async () => ++n);
    const cache = createTtlCache({ ttlMs: 1_000, now: () => t });
    const [a, b] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    expect([a, b]).toEqual([1, 1]);
    expect(await cache.get("k", load)).toBe(1);
    t = 1_500;
    expect(await cache.get("k", load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("does not cache failures", async () => {
    const cache = createTtlCache({ ttlMs: 1_000, now: () => 0 });
    await expect(cache.get("k", async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(await cache.get("k", async () => 7)).toBe(7);
  });
});
