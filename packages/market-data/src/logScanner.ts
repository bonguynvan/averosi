import type { RawLog } from "@app/core";

/** JSON-RPC call (e.g. viem client.request) against an archive-capable endpoint. */
export type RpcRequest = (method: string, params: unknown[]) => Promise<unknown>;

export interface LogScanResult {
  readonly logs: RawLog[];
  readonly scannedFrom: bigint;
  readonly scannedTo: bigint;
  /** false when the request budget ran out before reaching `fromBlock`. */
  readonly complete: boolean;
}

export interface LogScannerOptions {
  readonly request: RpcRequest;
  /** Upper bound of eth_getLogs calls per scan (protects quotas and latency). */
  readonly maxRequests: number;
  readonly minSpan?: bigint;
}

/**
 * Errors meaning "ask for a smaller (more recent) window", across providers' wording — including
 * non-archive nodes that cannot serve old state ("unknown state", "pruned"): the scan then stays honest
 * by ending as partial.
 */
const RANGE_ERROR = /range|limit|too many|exceed|more than|10000|timeout|response size|unknown state|first available|archive|pruned|missing trie/i;

/**
 * Many providers state their limit ("ranges over 10000 blocks", "limited to 0 - 50 blocks range",
 * "max block range 10000"). Use the largest number below the failed span as the next window.
 */
export function rangeHint(message: string, failedSpan: bigint): bigint | null {
  const numbers = (message.match(/\d[\d,]*/g) ?? []).map((n) => BigInt(n.replaceAll(",", ""))).filter((n) => n > 1n && n < failedSpan);
  return numbers.length > 0 ? numbers.reduce((a, b) => (a > b ? a : b)) : null;
}

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  logIndex: string;
  transactionHash: string;
}

const toRawLog = (l: RpcLog): RawLog => ({
  address: l.address,
  topics: l.topics,
  data: l.data,
  blockNumber: BigInt(l.blockNumber),
  logIndex: Number(l.logIndex),
  transactionHash: l.transactionHash,
});

const hex = (n: bigint) => `0x${n.toString(16)}`;

/**
 * Scans eth_getLogs from the chain head backwards with an adaptive window: halves on range errors,
 * doubles after successes. Newest-first means a partial scan still contains the most recent events.
 */
export function createLogScanner({ request, maxRequests, minSpan = 1n }: LogScannerOptions) {
  return {
    async scan(filter: { topics: readonly (string | readonly string[] | null)[]; fromBlock: bigint; address?: string }): Promise<LogScanResult> {
      const latest = BigInt((await request("eth_blockNumber", [])) as string);
      let cursor = latest; // inclusive upper bound of the next window
      let span = latest - filter.fromBlock + 1n;
      let ceiling = span; // largest window not yet known to fail
      let requests = 0;
      const logs: RawLog[] = [];

      while (cursor >= filter.fromBlock && requests < maxRequests) {
        const from = cursor - span + 1n > filter.fromBlock ? cursor - span + 1n : filter.fromBlock;
        requests += 1;
        try {
          const page = (await request("eth_getLogs", [
            { fromBlock: hex(from), toBlock: hex(cursor), topics: filter.topics, ...(filter.address ? { address: filter.address } : {}) },
          ])) as RpcLog[];
          logs.push(...page.map(toRawLog));
          cursor = from - 1n;
          span = span * 2n < ceiling ? span * 2n : ceiling;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!RANGE_ERROR.test(message)) throw error;
          if (span <= minSpan) break; // cannot go narrower: older history is unavailable → honest partial result
          const next = rangeHint(message, span) ?? span / 2n;
          span = next > minSpan ? next : minSpan;
          ceiling = span;
        }
      }

      const complete = cursor < filter.fromBlock;
      return { logs: logs.sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1)), scannedFrom: complete ? filter.fromBlock : cursor + 1n, scannedTo: latest, complete };
    },
  };
}
