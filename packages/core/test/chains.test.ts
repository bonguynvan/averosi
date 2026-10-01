import { describe, expect, test } from "vitest";
import { type ChainKey, SUPPORTED_CHAINS, chainInfo, explorerAddressUrl, parseChainKey } from "../src/domain/chains";

describe("chains", () => {
  test("supports Ethereum, Base and BNB Chain", () => {
    expect(SUPPORTED_CHAINS.map((c) => c.key)).toEqual(["ethereum", "base", "bsc"]);
  });

  test("parseChainKey accepts known keys only", () => {
    expect(parseChainKey("base")).toEqual({ ok: true, value: "base" });
    expect(parseChainKey("solana")).toEqual({ ok: false, error: "UNSUPPORTED_CHAIN" });
  });

  test("explorerAddressUrl builds a chain explorer link", () => {
    expect(explorerAddressUrl("bsc", "0xabc")).toBe("https://bscscan.com/address/0xabc");
  });
});

describe("chainInfo", () => {
  test("throws for a key outside the supported set", () => {
    expect(() => chainInfo("solana" as ChainKey)).toThrow("Unknown chain solana");
  });
});
