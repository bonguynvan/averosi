import { describe, expect, test } from "vitest";
import { buildCsp } from "@/proxy";

describe("buildCsp", () => {
  test("production policy uses the nonce and forbids eval, framing and plugins", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  test("development policy allows eval and websocket HMR only in dev", () => {
    const csp = buildCsp("n", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});
