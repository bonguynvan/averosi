import {
  ALL_APPROVAL_TOPICS,
  type AddressListSource,
  type AllowanceState,
  type ApprovalCandidate,
  type ApprovalKind,
  type ChainKey,
  type ChainReader,
  type EvmAddress,
  PERMIT2_ADDRESS,
  type RawLog,
  classifyAllowance,
  extractApprovalCandidates,
  ownerTopic,
  parseEvmAddress,
} from "@app/core";
import { erc20Abi, parseAbi } from "viem";
import type { MulticallClient } from "../wallet/portfolio";

const NFT_ABI = parseAbi(["function isApprovedForAll(address owner, address operator) view returns (bool)", "function symbol() view returns (string)"]);
const PERMIT2_ABI = parseAbi(["function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)"]);

/** Newest candidates checked per scan (bounded multicall size). */
const MAX_CANDIDATES = 300;
const MAX_SPENDER_PROFILES = 60;

interface Scanner {
  scan(filter: { topics: readonly (string | readonly string[] | null)[]; fromBlock: bigint }): Promise<{ logs: RawLog[]; scannedFrom: bigint; scannedTo: bigint; complete: boolean }>;
}

export interface ApprovalServiceDeps {
  /** Archive-capable log scanner per chain, or null when no archive endpoint is configured. */
  readonly scannerFor: (chain: ChainKey) => Scanner | null;
  readonly multicallFor: (chain: ChainKey) => MulticallClient;
  readonly sanctions: AddressListSource;
  readonly phishing: AddressListSource;
  readonly chainReader: ChainReader;
  readonly nowSeconds?: () => number;
  readonly ttlMs: number;
  readonly now?: () => number;
}

export interface ApprovalView {
  readonly kind: ApprovalKind;
  readonly token: { readonly address: string; readonly symbol: string | null; readonly decimals: number | null };
  readonly spender: {
    readonly address: string;
    readonly kind: "eoa" | "contract" | null;
    readonly upgradeable: boolean | null;
    readonly flags: { readonly sanctioned: boolean | null; readonly phishing: boolean | null };
  };
  /** Raw allowance (token units) for ERC-20/Permit2; null for NFT operator approvals. */
  readonly amount: bigint | null;
  readonly unlimited: boolean;
  /** Permit2 expiry (unix seconds). */
  readonly expiration: number | null;
  readonly lastBlock: bigint;
  readonly lastTx: string;
}

export type ApprovalReport =
  | { readonly status: "unconfigured"; readonly chain: ChainKey; readonly owner: EvmAddress }
  | {
      readonly status: "complete" | "partial";
      readonly chain: ChainKey;
      readonly owner: EvmAddress;
      readonly scannedFrom: bigint;
      readonly scannedTo: bigint;
      readonly candidates: number;
      readonly approvals: readonly ApprovalView[];
      readonly checkedAt: number;
    };

type CallResult = { status: "success"; result: unknown } | { status: "failure"; error: unknown };

function stateCall(c: ApprovalCandidate, owner: string) {
  if (c.kind === "erc20") return { address: c.token, abi: erc20Abi, functionName: "allowance", args: [owner, c.spender] };
  if (c.kind === "nft-all") return { address: c.token, abi: NFT_ABI, functionName: "isApprovedForAll", args: [owner, c.spender] };
  return { address: PERMIT2_ADDRESS, abi: PERMIT2_ABI, functionName: "allowance", args: [owner, c.token, c.spender] };
}

function toState(kind: ApprovalKind, r: CallResult | undefined): AllowanceState | null {
  if (r?.status !== "success") return null;
  if (kind === "erc20") return typeof r.result === "bigint" ? { kind, amount: r.result } : null;
  if (kind === "nft-all") return typeof r.result === "boolean" ? { kind, approved: r.result } : null;
  const [amount, expiration] = r.result as [bigint, number];
  return { kind, amount, expiration: Number(expiration) };
}

async function spenderInfo(deps: ApprovalServiceDeps, chain: ChainKey, spender: string, profile: boolean) {
  const parsed = parseEvmAddress(spender);
  if (!parsed.ok) return { kind: null, upgradeable: null, flags: { sanctioned: null, phishing: null } };
  const [sanctioned, phishing, account] = await Promise.all([
    deps.sanctions.contains(parsed.value).then((r) => r.data, () => null),
    deps.phishing.contains(parsed.value).then((r) => r.data, () => null),
    profile ? deps.chainReader.accountProfile(chain, parsed.value).then((r) => r.data, () => null) : Promise.resolve(null),
  ]);
  return { kind: account?.kind ?? null, upgradeable: account ? account.isUpgradeableProxy : null, flags: { sanctioned, phishing } };
}

/**
 * Full-history approval check: logs nominate (token, spender) pairs, then current allowances are
 * re-read on-chain; only active ones are returned. Cached per chain+owner, never per visitor.
 */
export function createApprovalService(deps: ApprovalServiceDeps) {
  const now = deps.now ?? Date.now;
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  let cache = new Map<string, ApprovalReport & { checkedAt: number }>();

  async function run(chain: ChainKey, owner: EvmAddress): Promise<ApprovalReport> {
    const scanner = deps.scannerFor(chain);
    if (!scanner) return { status: "unconfigured", chain, owner };
    // Block 1: genesis has no logs and some providers reject block 0 ("first available state is 1").
    const scan = await scanner.scan({ topics: [[...ALL_APPROVAL_TOPICS], ownerTopic(owner)], fromBlock: 1n });
    const candidates = extractApprovalCandidates(scan.logs).slice(0, MAX_CANDIDATES);

    const client = deps.multicallFor(chain);
    const states = (await client.multicall({ contracts: candidates.map((c) => stateCall(c, owner)), allowFailure: true })) as CallResult[];
    const active = candidates.flatMap((c, i) => {
      const state = toState(c.kind, states[i]);
      if (!state) return [];
      const { active: isActive, unlimited } = classifyAllowance(state, nowSeconds());
      return isActive ? [{ c, state, unlimited }] : [];
    });

    const tokens = [...new Set(active.map((a) => a.c.token))];
    const meta = (await client.multicall({
      contracts: tokens.flatMap((address) => [
        { address, abi: erc20Abi, functionName: "symbol" },
        { address, abi: erc20Abi, functionName: "decimals" },
      ]),
      allowFailure: true,
    })) as CallResult[];
    const tokenMeta = new Map(
      tokens.map((address, i) => {
        const symbol = meta[i * 2];
        const decimals = meta[i * 2 + 1];
        return [
          address,
          {
            symbol: symbol?.status === "success" && typeof symbol.result === "string" ? symbol.result : null,
            decimals: decimals?.status === "success" && typeof decimals.result === "number" ? decimals.result : null,
          },
        ];
      }),
    );

    const spenders = [...new Set(active.map((a) => a.c.spender))];
    const infos = new Map(await Promise.all(spenders.map(async (s, i) => [s, await spenderInfo(deps, chain, s, i < MAX_SPENDER_PROFILES)] as const)));

    const approvals: ApprovalView[] = active.map(({ c, state, unlimited }) => ({
      kind: c.kind,
      token: { address: c.token, ...(tokenMeta.get(c.token) ?? { symbol: null, decimals: null }) },
      spender: { address: c.spender, ...(infos.get(c.spender) ?? { kind: null, upgradeable: null, flags: { sanctioned: null, phishing: null } }) },
      amount: state.kind === "nft-all" ? null : state.amount,
      unlimited,
      expiration: state.kind === "permit2" ? state.expiration : null,
      lastBlock: c.lastBlock,
      lastTx: c.lastTx,
    }));

    return {
      status: scan.complete ? "complete" : "partial",
      chain,
      owner,
      scannedFrom: scan.scannedFrom,
      scannedTo: scan.scannedTo,
      candidates: candidates.length,
      approvals,
      checkedAt: now(),
    };
  }

  return {
    async check(query: { chain: ChainKey; owner: EvmAddress; fresh?: boolean }): Promise<ApprovalReport> {
      const key = `${query.chain}:${query.owner}`;
      const t = now();
      const hit = cache.get(key);
      if (!query.fresh && hit && t - hit.checkedAt < deps.ttlMs) return hit;
      const report = await run(query.chain, query.owner);
      if (report.status !== "unconfigured") cache = new Map([...cache].filter(([, v]) => t - v.checkedAt < deps.ttlMs)).set(key, report);
      return report;
    },
  };
}

type Serialized<T> = T extends bigint
  ? string
  : T extends string | number | boolean | null | undefined
    ? T
    : T extends readonly (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;
export type SerializedApprovalReport = Serialized<ApprovalReport>;

/** bigint → decimal string, recursively (server actions/route handlers return JSON). */
export function serializeApprovalReport(report: ApprovalReport): SerializedApprovalReport {
  return JSON.parse(JSON.stringify(report, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))) as SerializedApprovalReport;
}
