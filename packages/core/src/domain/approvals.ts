/**
 * Token-approval discovery from event logs. Logs only nominate candidates; the current on-chain
 * allowance is always re-read before anything is shown (an old Approval may have been reset).
 */

/** keccak256 topics (verified with viem toEventSelector). */
export const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925"; // Approval(address,address,uint256)
export const APPROVAL_FOR_ALL_TOPIC = "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31"; // ApprovalForAll(address,address,bool)
export const PERMIT2_APPROVAL_TOPIC = "0xda9fa7c1b00402c17d0161b249b1ab8bbec047c5a52207b9c112deffd817036b"; // Approval(address,address,address,uint160,uint48)
export const PERMIT2_PERMIT_TOPIC = "0xc6a377bfc4eb120024a8ac08eef205be16b817020812c73223e81d1bdb9708ec"; // Permit(address,address,address,uint160,uint48,uint48)
export const PERMIT2_LOCKDOWN_TOPIC = "0x89b1add15eff56b3dfe299ad94e01f2b52fbcb80ae1a3baea6ae8c04cb2b98a4"; // Lockdown(address,address,address)

/** Uniswap Permit2 — same address on Ethereum, Base and BNB Chain (bytecode verified). */
export const PERMIT2_ADDRESS = "0x000000000022d473030f116ddee9f6b43ac78ba3";

export const ALL_APPROVAL_TOPICS = [APPROVAL_TOPIC, APPROVAL_FOR_ALL_TOPIC, PERMIT2_APPROVAL_TOPIC, PERMIT2_PERMIT_TOPIC, PERMIT2_LOCKDOWN_TOPIC] as const;

/** ≥ 2^255 is treated as "unlimited" (wallets usually approve 2^256−1). */
export const ERC20_UNLIMITED_THRESHOLD = 2n ** 255n;
export const PERMIT2_MAX_AMOUNT = 2n ** 160n - 1n;

export type ApprovalKind = "erc20" | "nft-all" | "permit2";

export interface RawLog {
  readonly address: string;
  readonly topics: readonly string[];
  readonly data: string;
  readonly blockNumber: bigint;
  readonly logIndex: number;
  readonly transactionHash: string;
}

export interface ApprovalCandidate {
  readonly kind: ApprovalKind;
  /** ERC-20 token, NFT collection, or the token inside Permit2. */
  readonly token: string;
  readonly spender: string;
  readonly lastBlock: bigint;
  readonly lastTx: string;
}

export function ownerTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

const topicAddress = (topic: string | undefined) => (topic ? `0x${topic.slice(-40).toLowerCase()}` : null);

function toCandidate(log: RawLog): Omit<ApprovalCandidate, "lastBlock" | "lastTx"> | null {
  const [topic0, , t2, t3] = log.topics;
  const emitter = log.address.toLowerCase();
  if (topic0 === APPROVAL_TOPIC && log.topics.length === 3) {
    const spender = topicAddress(t2);
    return spender ? { kind: "erc20", token: emitter, spender } : null;
  }
  if (topic0 === APPROVAL_FOR_ALL_TOPIC && log.topics.length === 3) {
    const spender = topicAddress(t2);
    return spender ? { kind: "nft-all", token: emitter, spender } : null;
  }
  const isPermit2Event = topic0 === PERMIT2_APPROVAL_TOPIC || topic0 === PERMIT2_PERMIT_TOPIC || topic0 === PERMIT2_LOCKDOWN_TOPIC;
  if (isPermit2Event && emitter === PERMIT2_ADDRESS) {
    const token = topicAddress(t2);
    const spender = topicAddress(t3);
    return token && spender ? { kind: "permit2", token, spender } : null;
  }
  return null; // single-NFT approvals and unrelated/spoofed events
}

/** Latest event per (kind, token, spender), newest first. */
export function extractApprovalCandidates(logs: readonly RawLog[]): ApprovalCandidate[] {
  const latest = new Map<string, { c: Omit<ApprovalCandidate, "lastBlock" | "lastTx">; log: RawLog }>();
  for (const log of logs) {
    const c = toCandidate(log);
    if (!c) continue;
    const key = `${c.kind}:${c.token}:${c.spender}`;
    const prev = latest.get(key);
    const newer = !prev || log.blockNumber > prev.log.blockNumber || (log.blockNumber === prev.log.blockNumber && log.logIndex > prev.log.logIndex);
    if (newer) latest.set(key, { c, log });
  }
  return [...latest.values()]
    .sort((a, b) => (a.log.blockNumber === b.log.blockNumber ? b.log.logIndex - a.log.logIndex : a.log.blockNumber > b.log.blockNumber ? -1 : 1))
    .map(({ c, log }) => ({ ...c, lastBlock: log.blockNumber, lastTx: log.transactionHash }));
}

export type AllowanceState =
  | { readonly kind: "erc20"; readonly amount: bigint }
  | { readonly kind: "nft-all"; readonly approved: boolean }
  | { readonly kind: "permit2"; readonly amount: bigint; readonly expiration: number };

export function classifyAllowance(state: AllowanceState, nowSeconds: number): { active: boolean; unlimited: boolean } {
  switch (state.kind) {
    case "erc20":
      return { active: state.amount > 0n, unlimited: state.amount >= ERC20_UNLIMITED_THRESHOLD };
    case "nft-all":
      return { active: state.approved, unlimited: state.approved };
    case "permit2": {
      const active = state.amount > 0n && state.expiration > nowSeconds;
      return { active, unlimited: active && state.amount >= PERMIT2_MAX_AMOUNT };
    }
  }
}
