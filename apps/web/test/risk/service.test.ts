import { type AddressListSource, type ChainReader, parseEvmAddress, sourced } from "@app/core";
import { describe, expect, test, vi } from "vitest";
import { createRiskService, serializeReport } from "@/lib/risk/service";

const ADDRESS = (() => {
  const r = parseEvmAddress("0x0330070FD38Ec3bB94F58FA55D40368271E9e54A");
  if (!r.ok) throw new Error("fixture");
  return r.value;
})();

function deps() {
  const contains = vi.fn(async () => sourced(true, "OFAC SDN", new Date(0)));
  const sanctions: AddressListSource = { name: "OFAC SDN", contains };
  const phishing: AddressListSource = { name: "ScamSniffer", contains: async () => sourced(false, "ScamSniffer", new Date(0)) };
  const chainReader: ChainReader = {
    accountProfile: async () => sourced({ kind: "eoa", txCount: 1, balanceWei: 10n ** 18n, isUpgradeableProxy: false, bytecodeSize: 0 }, "RPC ethereum", new Date(0)),
  };
  return { contains, deps: { sanctions, phishing, chainReader } };
}

describe("createRiskService", () => {
  test("caches reports per chain+address for the TTL", async () => {
    let t = 0;
    const { contains, deps: d } = deps();
    const service = createRiskService({ deps: d, ttlMs: 1_000, now: () => t });
    await service.check({ chain: "ethereum", address: ADDRESS });
    await service.check({ chain: "ethereum", address: ADDRESS });
    expect(contains).toHaveBeenCalledTimes(1);
    await service.check({ chain: "base", address: ADDRESS });
    expect(contains).toHaveBeenCalledTimes(2);
    t = 2_000;
    await service.check({ chain: "ethereum", address: ADDRESS });
    expect(contains).toHaveBeenCalledTimes(3);
  });
});

describe("serializeReport", () => {
  test("converts bigint and dates into JSON-safe values", async () => {
    const { deps: d } = deps();
    const report = await createRiskService({ deps: d, ttlMs: 1, now: () => 0 }).check({ chain: "ethereum", address: ADDRESS });
    const json = serializeReport(report);
    expect(json.account?.balanceWei).toBe("1000000000000000000");
    expect(json.sources[0]).toEqual({ name: "OFAC SDN", status: "ok", fetchedAt: "1970-01-01T00:00:00.000Z" });
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});
