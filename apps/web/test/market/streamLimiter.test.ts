import { describe, expect, test } from "vitest";
import { createStreamLimiter } from "@/lib/market/streamLimiter";

describe("createStreamLimiter", () => {
  test("caps concurrent streams per key and frees slots on release (idempotent)", () => {
    const limiter = createStreamLimiter(2);
    const a = limiter.acquire("ip");
    const b = limiter.acquire("ip");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(limiter.acquire("ip")).toBeNull();
    expect(limiter.acquire("other")).not.toBeNull();
    a?.();
    a?.(); // double release must not free two slots
    expect(limiter.acquire("ip")).not.toBeNull();
    expect(limiter.acquire("ip")).toBeNull();
  });
});
