import { describe, expect, test, vi } from "vitest";
import { createLogScanner } from "../src/logScanner";

const hex = (n: bigint | number) => `0x${n.toString(16)}`;

/** Fake archive RPC: rejects windows wider than `maxSpan`; returns one log per 1000th block in range. */
function fakeRpc(latest: bigint, maxSpan: bigint, opts: { failWith?: string } = {}) {
  return vi.fn(async (method: string, params: unknown[]) => {
    if (method === "eth_blockNumber") return hex(latest);
    if (opts.failWith) throw new Error(opts.failWith);
    const [{ fromBlock, toBlock }] = params as [{ fromBlock: string; toBlock: string }];
    const from = BigInt(fromBlock);
    const to = BigInt(toBlock);
    if (to - from + 1n > maxSpan) throw new Error("query exceeds max block range 10000");
    const logs = [];
    for (let b = from; b <= to; b++) if (b % 1000n === 0n) logs.push({ address: "0xA", topics: ["0x1"], data: "0x", blockNumber: hex(b), logIndex: "0x0", transactionHash: `0x${b}` });
    return logs;
  });
}

describe("createLogScanner", () => {
  test("whole history in one call when the provider allows it", async () => {
    const request = fakeRpc(5_000n, 10_000_000n);
    const result = await createLogScanner({ request, maxRequests: 10 }).scan({ topics: [["0x1"], "0xowner"], fromBlock: 0n });
    expect(result).toMatchObject({ complete: true, scannedFrom: 0n, scannedTo: 5_000n });
    expect(result.logs.map((l) => l.blockNumber)).toEqual([0n, 1_000n, 2_000n, 3_000n, 4_000n, 5_000n]);
    expect(request).toHaveBeenCalledTimes(2); // blockNumber + one getLogs
  });

  test("shrinks the window on range errors and still covers everything", async () => {
    const request = fakeRpc(50_000n, 10_000n);
    const result = await createLogScanner({ request, maxRequests: 200 }).scan({ topics: [["0x1"]], fromBlock: 0n });
    expect(result.complete).toBe(true);
    expect(result.logs).toHaveLength(51);
    expect(new Set(result.logs.map((l) => l.transactionHash)).size).toBe(51); // no duplicates, no gaps
  });

  test("jumps straight to the limit stated in the provider error and never oscillates above it", async () => {
    const request = fakeRpc(100_000n, 10_000n); // error text says "max block range 10000"
    const result = await createLogScanner({ request, maxRequests: 50 }).scan({ topics: [["0x1"]], fromBlock: 0n });
    expect(result.complete).toBe(true);
    // 1 blockNumber + 1 failed full-range probe + ceil(100_001 / 10_000) = 11 windows.
    expect(request.mock.calls.length).toBeLessThanOrEqual(14);
  });

  test("halves without a hint, then remembers the ceiling instead of re-growing past it", async () => {
    const request = vi.fn(async (method: string, params: unknown[]) => {
      if (method === "eth_blockNumber") return hex(40_000n);
      const [{ fromBlock, toBlock }] = params as [{ fromBlock: string; toBlock: string }];
      if (BigInt(toBlock) - BigInt(fromBlock) + 1n > 6_000n) throw new Error("block range too large");
      return [];
    });
    const result = await createLogScanner({ request, maxRequests: 40 }).scan({ topics: [["0x1"]], fromBlock: 0n });
    expect(result.complete).toBe(true);
    const failures = (await Promise.allSettled(request.mock.results.map((r) => r.value))).filter((r) => r.status === "rejected").length;
    expect(failures).toBeLessThanOrEqual(5); // a few halvings to find the ceiling, then no repeats
  });

  test("stops at the request budget and reports a partial, newest-first scan", async () => {
    const request = fakeRpc(1_000_000n, 10_000n);
    const result = await createLogScanner({ request, maxRequests: 12 }).scan({ topics: [["0x1"]], fromBlock: 0n });
    expect(result.complete).toBe(false);
    expect(result.scannedTo).toBe(1_000_000n);
    expect(result.scannedFrom).toBeGreaterThan(0n);
    expect(result.logs.every((l) => l.blockNumber >= result.scannedFrom)).toBe(true);
  });

  test("non-archive nodes ('unknown state' for old blocks) yield an honest partial scan", async () => {
    const request = vi.fn(async (method: string, params: unknown[]) => {
      if (method === "eth_blockNumber") return hex(100_000n);
      const [{ fromBlock }] = params as [{ fromBlock: string }];
      if (BigInt(fromBlock) < 90_000n) throw new Error("Unknown state. First available state is 1");
      return [];
    });
    const result = await createLogScanner({ request, maxRequests: 30 }).scan({ topics: [["0x1"]], fromBlock: 1n });
    expect(result.complete).toBe(false);
    expect(result.scannedFrom).toBeGreaterThanOrEqual(90_000n);
  });

  test("non-range errors (auth, network) are thrown, not retried forever", async () => {
    const request = fakeRpc(100n, 1_000n, { failWith: "401 unauthorized: invalid api key" });
    await expect(createLogScanner({ request, maxRequests: 50 }).scan({ topics: [["0x1"]], fromBlock: 0n })).rejects.toThrow("unauthorized");
  });
});
