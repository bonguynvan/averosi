import { describe, expect, test } from "vitest";
import { clientKeyFromHeaders, parseRiskForm } from "@/lib/risk/form";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseRiskForm", () => {
  test("accepts a valid chain and address", () => {
    expect(parseRiskForm(form({ chain: "base", address: " 0xAbCdEf0123456789abcdef0123456789ABCDEF01 " }))).toEqual({
      ok: true,
      value: { chain: "base", address: "0xabcdef0123456789abcdef0123456789abcdef01" },
    });
  });

  test("rejects unsupported chains and malformed addresses", () => {
    expect(parseRiskForm(form({ chain: "solana", address: "0x1111111111111111111111111111111111111111" }))).toEqual({
      ok: false,
      error: "UNSUPPORTED_CHAIN",
    });
    expect(parseRiskForm(form({ chain: "ethereum", address: "vitalik.eth" }))).toEqual({ ok: false, error: "INVALID_ADDRESS" });
    expect(parseRiskForm(form({}))).toEqual({ ok: false, error: "UNSUPPORTED_CHAIN" });
  });
});

describe("clientKeyFromHeaders", () => {
  test("prefers Cloudflare's connecting IP, then the first X-Forwarded-For hop", () => {
    expect(clientKeyFromHeaders(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
