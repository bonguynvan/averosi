import { describe, expect, test } from "vitest";
import {
  APPROVAL_FOR_ALL_TOPIC,
  APPROVAL_TOPIC,
  ERC20_UNLIMITED_THRESHOLD,
  PERMIT2_ADDRESS,
  PERMIT2_APPROVAL_TOPIC,
  PERMIT2_LOCKDOWN_TOPIC,
  PERMIT2_MAX_AMOUNT,
  type RawLog,
  classifyAllowance,
  extractApprovalCandidates,
  ownerTopic,
} from "../src/domain/approvals";

const OWNER = "0x00000000000000000000000000000000000000aa";
const TOKEN = "0x00000000000000000000000000000000000000bb";
const SPENDER = "0x00000000000000000000000000000000000000cc";
const t = (addr: string) => `0x${addr.slice(2).padStart(64, "0")}`;

const log = (over: Partial<RawLog>): RawLog => ({
  address: TOKEN,
  topics: [APPROVAL_TOPIC, t(OWNER), t(SPENDER)],
  data: "0x",
  blockNumber: 10n,
  logIndex: 0,
  transactionHash: "0xtx",
  ...over,
});

describe("ownerTopic", () => {
  test("left-pads the lowercased address to 32 bytes", () => {
    expect(ownerTopic("0x00000000000000000000000000000000000000AA")).toBe(t(OWNER));
  });
});

describe("extractApprovalCandidates", () => {
  test("ERC-20 approvals (3 topics) dedupe to the latest per token+spender", () => {
    const out = extractApprovalCandidates([
      log({ blockNumber: 5n, transactionHash: "0xold" }),
      log({ blockNumber: 9n, transactionHash: "0xnew" }),
    ]);
    expect(out).toEqual([{ kind: "erc20", token: TOKEN, spender: SPENDER, lastBlock: 9n, lastTx: "0xnew" }]);
  });

  test("single-NFT approvals (4 topics) are ignored; ApprovalForAll is captured", () => {
    const out = extractApprovalCandidates([
      log({ topics: [APPROVAL_TOPIC, t(OWNER), t(SPENDER), t("0x01")] }),
      log({ topics: [APPROVAL_FOR_ALL_TOPIC, t(OWNER), t(SPENDER)], data: t("0x01") }),
    ]);
    expect(out).toEqual([{ kind: "nft-all", token: TOKEN, spender: SPENDER, lastBlock: 10n, lastTx: "0xtx" }]);
  });

  test("Permit2 events: token and spender come from topics; only from the Permit2 contract", () => {
    const fromPermit2 = log({ address: PERMIT2_ADDRESS, topics: [PERMIT2_APPROVAL_TOPIC, t(OWNER), t(TOKEN), t(SPENDER)] });
    const lockdown = log({ address: PERMIT2_ADDRESS, topics: [PERMIT2_LOCKDOWN_TOPIC, t(OWNER), t(TOKEN), t(SPENDER)], blockNumber: 11n });
    const spoofed = log({ address: TOKEN, topics: [PERMIT2_APPROVAL_TOPIC, t(OWNER), t(TOKEN), t(SPENDER)] });
    expect(extractApprovalCandidates([fromPermit2, lockdown, spoofed])).toEqual([
      { kind: "permit2", token: TOKEN, spender: SPENDER, lastBlock: 11n, lastTx: "0xtx" },
    ]);
  });

  test("tie on block number is broken by log index; output is sorted newest first", () => {
    const a = log({ logIndex: 1, transactionHash: "0xa" });
    const b = log({ logIndex: 3, transactionHash: "0xb" });
    const other = log({ address: "0x00000000000000000000000000000000000000dd", blockNumber: 2n });
    const out = extractApprovalCandidates([b, a, other]);
    expect(out.map((c) => c.lastTx)).toEqual(["0xb", "0xtx"]);
  });
});

describe("classifyAllowance", () => {
  const NOW = 1_800_000_000;

  test("ERC-20: zero inactive, huge counts as unlimited", () => {
    expect(classifyAllowance({ kind: "erc20", amount: 0n }, NOW)).toEqual({ active: false, unlimited: false });
    expect(classifyAllowance({ kind: "erc20", amount: 5n }, NOW)).toEqual({ active: true, unlimited: false });
    expect(classifyAllowance({ kind: "erc20", amount: ERC20_UNLIMITED_THRESHOLD }, NOW)).toEqual({ active: true, unlimited: true });
  });

  test("NFT operator approval is all-or-nothing", () => {
    expect(classifyAllowance({ kind: "nft-all", approved: true }, NOW)).toEqual({ active: true, unlimited: true });
    expect(classifyAllowance({ kind: "nft-all", approved: false }, NOW)).toEqual({ active: false, unlimited: false });
  });

  test("Permit2: expired or zero allowances are inactive", () => {
    expect(classifyAllowance({ kind: "permit2", amount: 10n, expiration: NOW + 60 }, NOW)).toEqual({ active: true, unlimited: false });
    expect(classifyAllowance({ kind: "permit2", amount: PERMIT2_MAX_AMOUNT, expiration: NOW + 60 }, NOW)).toEqual({ active: true, unlimited: true });
    expect(classifyAllowance({ kind: "permit2", amount: 10n, expiration: NOW - 1 }, NOW)).toEqual({ active: false, unlimited: false });
    expect(classifyAllowance({ kind: "permit2", amount: 0n, expiration: NOW + 60 }, NOW)).toEqual({ active: false, unlimited: false });
  });
});
