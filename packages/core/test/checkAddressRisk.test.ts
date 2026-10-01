import { describe, expect, test } from "vitest";
import type { AccountProfile, AddressListSource, ChainReader } from "../src/application/ports";
import { checkAddressRisk } from "../src/application/usecases/checkAddressRisk";
import { parseEvmAddress } from "../src/domain/address";
import { sourced } from "../src/domain/sourced";

const AT = new Date("2026-10-01T00:00:00Z");
const ADDRESS = (() => {
  const r = parseEvmAddress("0x0330070FD38Ec3bB94F58FA55D40368271E9e54A");
  if (!r.ok) throw new Error("fixture");
  return r.value;
})();

const PROFILE: AccountProfile = { kind: "eoa", txCount: 3, balanceWei: 0n, isUpgradeableProxy: false, bytecodeSize: 0 };

const list = (name: string, hit: boolean): AddressListSource => ({
  name,
  contains: async () => sourced(hit, name, AT),
});
const broken = (name: string): AddressListSource => ({
  name,
  contains: async () => {
    throw new Error("network down");
  },
});
const reader = (profile: AccountProfile = PROFILE): ChainReader => ({
  accountProfile: async () => sourced(profile, "RPC ethereum", AT),
});

describe("checkAddressRisk", () => {
  test("combines all sources into a report", async () => {
    const report = await checkAddressRisk(
      { sanctions: list("OFAC SDN", true), phishing: list("ScamSniffer", false), chainReader: reader() },
      { chain: "ethereum", address: ADDRESS },
    );
    expect(report.level).toBe("high");
    expect(report.chain).toBe("ethereum");
    expect(report.address).toBe(ADDRESS);
    expect(report.account).toEqual(PROFILE);
    expect(report.sources).toEqual([
      { name: "OFAC SDN", status: "ok", fetchedAt: AT },
      { name: "ScamSniffer", status: "ok", fetchedAt: AT },
      { name: "RPC ethereum", status: "ok", fetchedAt: AT },
    ]);
  });

  test("a throwing source becomes a failed check instead of failing the whole report", async () => {
    const report = await checkAddressRisk(
      { sanctions: broken("OFAC SDN"), phishing: list("ScamSniffer", false), chainReader: reader() },
      { chain: "ethereum", address: ADDRESS },
    );
    expect(report.level).toBe("unknown");
    expect(report.sources[0]).toEqual({ name: "OFAC SDN", status: "failed" });
  });

  test("failed chain read reports null account", async () => {
    const chainReader: ChainReader = {
      accountProfile: async () => {
        throw new Error("timeout");
      },
    };
    const report = await checkAddressRisk(
      { sanctions: list("OFAC SDN", false), phishing: list("ScamSniffer", false), chainReader },
      { chain: "base", address: ADDRESS },
    );
    expect(report.account).toBeNull();
    expect(report.sources[2]).toEqual({ name: "RPC base", status: "failed" });
  });
});
