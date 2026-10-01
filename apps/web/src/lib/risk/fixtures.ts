import { type AccountProfile, type CheckAddressRiskDeps, sourced } from "@app/core";

/**
 * Deterministic offline sources for e2e tests (RISK_DATA_MODE=fixture). Never enabled by default.
 * - FIXTURE_SANCTIONED is on the real OFAC SDN list (public data).
 * - Addresses starting with 0x2222 behave as an upgradeable proxy contract.
 * - Addresses starting with 0xdead make every source fail.
 */
export const FIXTURE_SANCTIONED = "0x0330070fd38ec3bb94f58fa55d40368271e9e54a";
const AT = new Date("2026-10-01T00:00:00Z");

const failsFor = (address: string) => address.startsWith("0xdead");

export function createFixtureDeps(): CheckAddressRiskDeps {
  return {
    sanctions: {
      name: "OFAC SDN",
      contains: async (address) => {
        if (failsFor(address)) throw new Error("fixture failure");
        return sourced(address === FIXTURE_SANCTIONED, "OFAC SDN", AT);
      },
    },
    phishing: {
      name: "ScamSniffer",
      contains: async (address) => {
        if (failsFor(address)) throw new Error("fixture failure");
        return sourced(false, "ScamSniffer", AT);
      },
    },
    chainReader: {
      accountProfile: async (chain, address) => {
        if (failsFor(address)) throw new Error("fixture failure");
        const isProxy = address.startsWith("0x2222");
        const profile: AccountProfile = isProxy
          ? { kind: "contract", txCount: 1, balanceWei: 0n, isUpgradeableProxy: true, bytecodeSize: 1_024 }
          : { kind: "eoa", txCount: 7, balanceWei: 1_500_000_000_000_000_000n, isUpgradeableProxy: false, bytecodeSize: 0 };
        return sourced(profile, `RPC ${chain}`, AT);
      },
    },
  };
}
