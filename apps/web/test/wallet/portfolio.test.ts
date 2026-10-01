import { type AddressListSource, type ChainReader, parseEvmAddress, sourced } from "@app/core";
import { describe, expect, test, vi } from "vitest";
import { STABLE_TOKENS, createTokenReader, createWalletService, serializeWalletView } from "@/lib/wallet/portfolio";

const ADDR = (() => {
  const r = parseEvmAddress("0x1111111111111111111111111111111111111111");
  if (!r.ok) throw new Error("fixture");
  return r.value;
})();
const AT = new Date(0);

describe("STABLE_TOKENS", () => {
  test("verified USDT/USDC per chain with correct decimals", () => {
    expect(STABLE_TOKENS.ethereum.map((t) => `${t.symbol}:${t.decimals}`)).toEqual(["USDT:6", "USDC:6"]);
    expect(STABLE_TOKENS.base.map((t) => `${t.symbol}:${t.decimals}`)).toEqual(["USDC:6", "USDT:6"]);
    expect(STABLE_TOKENS.bsc.map((t) => `${t.symbol}:${t.decimals}`)).toEqual(["USDT:18", "USDC:18"]);
  });
});

describe("createTokenReader", () => {
  test("one multicall per wallet; failed calls are reported as null balances", async () => {
    const multicall = vi.fn(async () => [
      { status: "success" as const, result: 5_000_000n },
      { status: "failure" as const, error: new Error("x") },
    ]);
    const reader = createTokenReader({ clientFor: () => ({ multicall }), now: () => AT });
    const result = await reader.balances("ethereum", ADDR);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual([
      { symbol: "USDT", contract: STABLE_TOKENS.ethereum[0]?.address, decimals: 6, balance: 5_000_000n },
      { symbol: "USDC", contract: STABLE_TOKENS.ethereum[1]?.address, decimals: 6, balance: null },
    ]);
    expect(result.source).toBe("RPC ethereum");
  });
});

function deps(overrides: Partial<Parameters<typeof createWalletService>[0]> = {}) {
  const chainReader: ChainReader = {
    accountProfile: vi.fn(async () => sourced({ kind: "eoa" as const, txCount: 4, balanceWei: 10n ** 18n, isUpgradeableProxy: false, bytecodeSize: 0 }, "RPC ethereum", AT)),
  };
  const list = (hit: boolean): AddressListSource => ({ name: "L", contains: async () => sourced(hit, "L", AT) });
  const tokens = { balances: vi.fn(async () => sourced([], "RPC ethereum", AT)) };
  return { chainReader, sanctions: list(true), phishing: list(false), tokens, ttlMs: 30_000, now: () => 0, ...overrides };
}

describe("createWalletService", () => {
  test("combines profile, tokens and list flags; caches per chain+address", async () => {
    const d = deps();
    const service = createWalletService(d);
    const view = await service.read({ chain: "ethereum", address: ADDR });
    expect(view).toMatchObject({ chain: "ethereum", address: ADDR, flags: { sanctioned: true, phishing: false } });
    expect(view.account?.txCount).toBe(4);
    await service.read({ chain: "ethereum", address: ADDR });
    expect(d.chainReader.accountProfile).toHaveBeenCalledTimes(1);
  });

  test("a failing part degrades to null instead of failing the wallet", async () => {
    const service = createWalletService(
      deps({
        chainReader: { accountProfile: async () => Promise.reject(new Error("rpc")) },
        sanctions: { name: "L", contains: async () => Promise.reject(new Error("list")) },
        tokens: { balances: async () => Promise.reject(new Error("rpc")) },
      }),
    );
    const view = await service.read({ chain: "base", address: ADDR });
    expect(view.account).toBeNull();
    expect(view.tokens).toBeNull();
    expect(view.flags.sanctioned).toBeNull();
  });

  test("serializeWalletView makes bigints JSON-safe", async () => {
    const view = await createWalletService(deps()).read({ chain: "ethereum", address: ADDR });
    const json = serializeWalletView({ ...view, tokens: [{ symbol: "USDT", contract: "0x", decimals: 6, balance: 7n }] });
    expect(json.account?.balanceWei).toBe("1000000000000000000");
    expect(json.tokens?.[0]?.balance).toBe("7");
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});
