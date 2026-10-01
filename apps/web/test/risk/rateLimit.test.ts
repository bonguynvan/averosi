import { describe, expect, test } from "vitest";
import { createRateLimiter } from "@/lib/risk/rateLimit";

describe("createRateLimiter", () => {
  test("allows up to the limit within the window, then blocks", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });
    expect(limiter.take("ip")).toBe(true);
    expect(limiter.take("ip")).toBe(true);
    expect(limiter.take("ip")).toBe(false);
    now = 1_001;
    expect(limiter.take("ip")).toBe(true);
  });

  test("keys are independent", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 0 });
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("b")).toBe(true);
    expect(limiter.take("a")).toBe(false);
  });

  test("forgets keys once their window has passed (no long-lived IP storage)", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now });
    limiter.take("a");
    now = 5_000;
    limiter.take("b");
    expect(limiter.size()).toBe(1);
  });
});
