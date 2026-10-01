import { APPROVAL_FOR_ALL_TOPIC, APPROVAL_TOPIC, type AccountProfile, type CheckAddressRiskDeps, sourced } from "@app/core";
import { type MulticallClient, STABLE_TOKENS, type TokenReader } from "../wallet/portfolio";

/**
 * Deterministic offline sources for e2e tests (DATA_MODE=fixture). Never enabled by default.
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

/** Fixture stablecoin balances: first token 1,234.5, second token failed (null). */
export const FIXTURE_TOKENS: TokenReader = {
  balances: async (chain) =>
    sourced(
      STABLE_TOKENS[chain].map((t, i) => ({ symbol: t.symbol, contract: t.address, decimals: t.decimals, balance: i === 0 ? 1_234_500_000n * 10n ** BigInt(t.decimals - 6) : null })),
      `RPC ${chain}`,
      AT,
    ),
};

/** Fixture approvals (any owner): unlimited USDT to a router-like spender, and an NFT operator flagged as phishing-free proxy. */
export const FIXTURE_TOKEN = "0x00000000000000000000000000000000000000b1";
export const FIXTURE_COLLECTION = "0x00000000000000000000000000000000000000b2";
export const FIXTURE_SPENDER = "0x2222222222222222222222222222222222222222";
const topic = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;

export const FIXTURE_APPROVAL_SCANNER = {
  scan: async (filter: { topics: readonly (string | readonly string[] | null)[] }) => {
    const owner = filter.topics[1] as string;
    return {
      logs: [
        { address: FIXTURE_TOKEN, topics: [APPROVAL_TOPIC, owner, topic(FIXTURE_SPENDER)], data: "0x", blockNumber: 100n, logIndex: 0, transactionHash: "0xa1" },
        { address: FIXTURE_COLLECTION, topics: [APPROVAL_FOR_ALL_TOPIC, owner, topic(FIXTURE_SANCTIONED)], data: "0x", blockNumber: 101n, logIndex: 0, transactionHash: "0xa2" },
      ],
      scannedFrom: 0n,
      scannedTo: 200n,
      complete: true,
    };
  },
};

export const FIXTURE_APPROVAL_MULTICALL: MulticallClient = {
  multicall: async ({ contracts }) =>
    (contracts as { address: string; functionName: string }[]).map((c) => {
      if (c.functionName === "allowance") return { status: "success" as const, result: 2n ** 256n - 1n };
      if (c.functionName === "isApprovedForAll") return { status: "success" as const, result: true };
      if (c.functionName === "symbol") return { status: "success" as const, result: c.address === FIXTURE_TOKEN ? "USDT" : "NFTX" };
      if (c.functionName === "decimals") return c.address === FIXTURE_TOKEN ? { status: "success" as const, result: 6 } : { status: "failure" as const, error: new Error("n/a") };
      return { status: "failure" as const, error: new Error("unknown") };
    }),
};

/** Fixture JSON-RPC for the browser proxy: every transaction is mined successfully at block 0x100. */
export function fixtureRpc(chain: string, method: string, params: readonly string[]): unknown {
  const chainId = chain === "base" ? "0x2105" : chain === "bsc" ? "0x38" : "0x1";
  if (method === "eth_chainId") return chainId;
  if (method === "eth_blockNumber") return "0x101";
  const hash = params[0] ?? `0x${"00".repeat(32)}`;
  if (method === "eth_getTransactionByHash") {
    return { hash, blockNumber: "0x100", blockHash: `0x${"cd".repeat(32)}`, from: `0x${"33".repeat(20)}`, to: null, input: "0x", nonce: "0x0", value: "0x0", gas: "0x5208", type: "0x2", chainId, transactionIndex: "0x0", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1", r: "0x1", s: "0x1", v: "0x0", yParity: "0x0", accessList: [] };
  }
  return {
    blockHash: `0x${"cd".repeat(32)}`,
    blockNumber: "0x100",
    contractAddress: null,
    cumulativeGasUsed: "0x5208",
    effectiveGasPrice: "0x1",
    from: `0x${"33".repeat(20)}`,
    gasUsed: "0x5208",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    status: "0x1",
    to: null,
    transactionHash: hash,
    transactionIndex: "0x0",
    type: "0x2",
  };
}
