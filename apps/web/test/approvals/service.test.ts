import {
  APPROVAL_FOR_ALL_TOPIC,
  APPROVAL_TOPIC,
  type AddressListSource,
  type ChainReader,
  PERMIT2_ADDRESS,
  PERMIT2_APPROVAL_TOPIC,
  type RawLog,
  parseEvmAddress,
  sourced,
} from "@app/core";
import { describe, expect, test, vi } from "vitest";
import { createApprovalService, serializeApprovalReport } from "@/lib/approvals/service";

const OWNER = (() => {
  const r = parseEvmAddress("0x00000000000000000000000000000000000000aa");
  if (!r.ok) throw new Error("fixture");
  return r.value;
})();
const USDT = "0x00000000000000000000000000000000000000b1";
const NFT = "0x00000000000000000000000000000000000000b2";
const SPENDER = "0x00000000000000000000000000000000000000c1";
const BAD = "0x00000000000000000000000000000000000000c2";
const t = (a: string) => `0x${a.slice(2).padStart(64, "0")}`;
const log = (address: string, topics: string[], block: bigint): RawLog => ({ address, topics, data: "0x", blockNumber: block, logIndex: 0, transactionHash: `0x${block}` });

const LOGS = [
  log(USDT, [APPROVAL_TOPIC, t(OWNER), t(SPENDER)], 10n), // still active, unlimited
  log(USDT, [APPROVAL_TOPIC, t(OWNER), t(BAD)], 11n), // already reset to 0 → hidden
  log(NFT, [APPROVAL_FOR_ALL_TOPIC, t(OWNER), t(BAD)], 12n), // active operator, flagged spender
  log(PERMIT2_ADDRESS, [PERMIT2_APPROVAL_TOPIC, t(OWNER), t(USDT), t(SPENDER)], 13n), // expired → hidden
];

/** Answers multicall by function name and args. */
function fakeMulticall() {
  type Call = { address: string; functionName: string; args?: readonly unknown[] };
  return vi.fn(async ({ contracts }: { contracts: readonly unknown[]; allowFailure: true }) =>
    (contracts as Call[]).map((c): { status: "success"; result: unknown } | { status: "failure"; error: unknown } => {
      switch (c.functionName) {
        case "allowance":
          if (c.address.toLowerCase() === PERMIT2_ADDRESS) return { status: "success" as const, result: [5n, 1, 0] }; // expired (expiration 1)
          return { status: "success" as const, result: (c.args?.[1] as string) === SPENDER ? 2n ** 256n - 1n : 0n };
        case "isApprovedForAll":
          return { status: "success" as const, result: true };
        case "symbol":
          return { status: "success" as const, result: c.address === USDT ? "USDT" : "PUNK" };
        case "decimals":
          return c.address === USDT ? { status: "success" as const, result: 6 } : { status: "failure" as const, error: new Error("no decimals") };
        default:
          return { status: "failure" as const, error: new Error("unknown") };
      }
    }),
  );
}

function deps(over: Partial<Parameters<typeof createApprovalService>[0]> = {}) {
  const scan = vi.fn(async () => ({ logs: LOGS, scannedFrom: 0n, scannedTo: 99n, complete: true }));
  const list = (bad: string): AddressListSource => ({ name: "L", contains: async (a) => sourced(a === bad, "L", new Date(0)) });
  const chainReader: ChainReader = {
    accountProfile: async () => sourced({ kind: "contract" as const, txCount: 1, balanceWei: 0n, isUpgradeableProxy: true, bytecodeSize: 100 }, "RPC", new Date(0)),
  };
  return {
    scannerFor: () => ({ scan }),
    multicallFor: () => ({ multicall: fakeMulticall() }),
    sanctions: list("none"),
    phishing: list(BAD),
    chainReader,
    nowSeconds: () => 1_800_000_000,
    ttlMs: 60_000,
    now: () => 0,
    scan,
    ...over,
  };
}

describe("createApprovalService", () => {
  test("returns only currently active approvals, with token metadata and spender risk", async () => {
    const d = deps();
    const report = await createApprovalService(d).check({ chain: "ethereum", owner: OWNER });
    if (report.status === "unconfigured") throw new Error("unexpected");
    expect(report.status).toBe("complete");
    expect(report.approvals.map((a) => [a.kind, a.token.address, a.spender.address])).toEqual([
      ["nft-all", NFT, BAD],
      ["erc20", USDT, SPENDER],
    ]);
    const erc20 = report.approvals[1];
    expect(erc20).toMatchObject({ unlimited: true, token: { symbol: "USDT", decimals: 6 }, spender: { kind: "contract", upgradeable: true } });
    expect(report.approvals[0]?.spender.flags.phishing).toBe(true);
    expect(report.candidates).toBe(4);
  });

  test("caches per chain+owner; `fresh` bypasses the cache (after a revoke)", async () => {
    const d = deps();
    const service = createApprovalService(d);
    await service.check({ chain: "ethereum", owner: OWNER });
    await service.check({ chain: "ethereum", owner: OWNER });
    expect(d.scan).toHaveBeenCalledTimes(1);
    await service.check({ chain: "ethereum", owner: OWNER, fresh: true });
    expect(d.scan).toHaveBeenCalledTimes(2);
  });

  test("no archive endpoint configured → explicit 'unconfigured' status", async () => {
    const report = await createApprovalService(deps({ scannerFor: () => null })).check({ chain: "bsc", owner: OWNER });
    expect(report).toEqual({ status: "unconfigured", chain: "bsc", owner: OWNER });
  });

  test("partial scans are reported as partial with the scanned range", async () => {
    const scan = vi.fn(async () => ({ logs: [], scannedFrom: 500n, scannedTo: 900n, complete: false }));
    const report = await createApprovalService(deps({ scannerFor: () => ({ scan }) })).check({ chain: "base", owner: OWNER });
    expect(report).toMatchObject({ status: "partial", scannedFrom: 500n, scannedTo: 900n, approvals: [] });
  });

  test("serializes bigints for JSON", async () => {
    const report = await createApprovalService(deps()).check({ chain: "ethereum", owner: OWNER });
    const json = serializeApprovalReport(report);
    expect(() => JSON.stringify(json)).not.toThrow();
    if (json.status === "unconfigured") throw new Error("unexpected");
    expect(json.scannedTo).toBe("99");
    expect(json.approvals[1]?.amount).toBe((2n ** 256n - 1n).toString());
  });
});
