import "server-only";
import type { ChainKey } from "@app/core";
import { type Chain, createPublicClient, http } from "viem";
import { base, bsc, mainnet } from "viem/chains";
import { z } from "zod";
import { type RpcClient, createChainReader } from "./chainReader";
import { createLogScanner } from "@app/market-data";
import { createApprovalService } from "../approvals/service";
import { type MulticallClient, createTokenReader, createWalletService } from "../wallet/portfolio";
import { FIXTURE_APPROVAL_MULTICALL, FIXTURE_APPROVAL_SCANNER, FIXTURE_TOKENS, createFixtureDeps, fixtureRpc } from "./fixtures";
import { createRateLimiter } from "./rateLimit";
import { createRemoteAddressList } from "./remoteAddressList";
import { createRiskService } from "./service";

const HOUR_MS = 3_600_000;
const REPORT_TTL_MS = 10 * 60_000;
const RPC_TIMEOUT_MS = 8_000;

/** Data sources shown to users on /rui-ro. Keep in sync with the methodology panel. */
export const RISK_LISTS = {
  sanctions: {
    name: "OFAC SDN",
    url: "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.json",
    homepage: "https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses",
  },
  phishing: {
    name: "ScamSniffer",
    url: "https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json",
    homepage: "https://github.com/scamsniffer/scam-database",
  },
} as const;

const EnvSchema = z.object({
  DATA_MODE: z.enum(["live", "fixture"]).default("live"),
  RPC_URL_ETHEREUM: z.url().default("https://ethereum-rpc.publicnode.com"),
  RPC_URL_BASE: z.url().default("https://base-rpc.publicnode.com"),
  RPC_URL_BSC: z.url().default("https://bsc-rpc.publicnode.com"),
  // Archive-capable endpoints with an API key (Alchemy, QuickNode, Ankr, PublicNode token…). Secrets: env only.
  ARCHIVE_RPC_URL_ETHEREUM: z.url().optional(),
  ARCHIVE_RPC_URL_BASE: z.url().optional(),
  ARCHIVE_RPC_URL_BSC: z.url().optional(),
});

const env = EnvSchema.parse({
  DATA_MODE: process.env.DATA_MODE || undefined,
  RPC_URL_ETHEREUM: process.env.RPC_URL_ETHEREUM || undefined,
  RPC_URL_BASE: process.env.RPC_URL_BASE || undefined,
  RPC_URL_BSC: process.env.RPC_URL_BSC || undefined,
  ARCHIVE_RPC_URL_ETHEREUM: process.env.ARCHIVE_RPC_URL_ETHEREUM || undefined,
  ARCHIVE_RPC_URL_BASE: process.env.ARCHIVE_RPC_URL_BASE || undefined,
  ARCHIVE_RPC_URL_BSC: process.env.ARCHIVE_RPC_URL_BSC || undefined,
});

const CHAIN_CONFIG: Record<ChainKey, { chain: Chain; url: string }> = {
  ethereum: { chain: mainnet, url: env.RPC_URL_ETHEREUM },
  base: { chain: base, url: env.RPC_URL_BASE },
  bsc: { chain: bsc, url: env.RPC_URL_BSC },
};

type ChainClient = RpcClient & MulticallClient;
const clients = new Map<ChainKey, ChainClient>();
function clientFor(key: ChainKey): ChainClient {
  const existing = clients.get(key);
  if (existing) return existing;
  const { chain, url } = CHAIN_CONFIG[key];
  const client = createPublicClient({ chain, transport: http(url, { timeout: RPC_TIMEOUT_MS, retryCount: 1 }) }) as unknown as ChainClient;
  clients.set(key, client);
  return client;
}

function liveDeps() {
  return {
    sanctions: createRemoteAddressList({ ...RISK_LISTS.sanctions, ttlMs: 6 * HOUR_MS }),
    phishing: createRemoteAddressList({ ...RISK_LISTS.phishing, ttlMs: 6 * HOUR_MS }),
    chainReader: createChainReader({ clientFor }),
  };
}

/** `DATA_MODE=fixture` swaps in deterministic offline sources for e2e tests. Shared by the risk center and wallet watch. */
const sources = env.DATA_MODE === "fixture" ? createFixtureDeps() : liveDeps();

export const riskService = createRiskService({ deps: sources, ttlMs: REPORT_TTL_MS });

/** Public-wallet snapshots for /vi: fresher cache (30s) than risk reports. */
export const walletService = createWalletService({
  ...sources,
  tokens: env.DATA_MODE === "fixture" ? FIXTURE_TOKENS : createTokenReader({ clientFor }),
  ttlMs: 30_000,
});

/** Wallet refreshes: a full 20-wallet watchlist every minute fits comfortably. */
export const walletRateLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** 10 checks per minute per client. */
export const riskRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const ARCHIVE_URL: Record<ChainKey, string | undefined> = {
  ethereum: env.ARCHIVE_RPC_URL_ETHEREUM,
  base: env.ARCHIVE_RPC_URL_BASE,
  bsc: env.ARCHIVE_RPC_URL_BSC,
};
/** Log scans are bounded per request: enough for most wallets, otherwise reported as partial. */
const MAX_LOG_REQUESTS = 60;

function archiveScanner(chain: ChainKey) {
  const url = ARCHIVE_URL[chain];
  if (!url) return null;
  const client = createPublicClient({ chain: CHAIN_CONFIG[chain].chain, transport: http(url, { timeout: 30_000, retryCount: 1 }) });
  return createLogScanner({ request: (method, params) => client.request({ method, params } as never), maxRequests: MAX_LOG_REQUESTS });
}

/** Token-approval checks (/quyen): full-history scan via archive RPC, current state via regular RPC. */
export const approvalService = createApprovalService(
  env.DATA_MODE === "fixture"
    ? { ...sources, scannerFor: () => FIXTURE_APPROVAL_SCANNER, multicallFor: () => FIXTURE_APPROVAL_MULTICALL, ttlMs: 5 * 60_000 }
    : { ...sources, scannerFor: archiveScanner, multicallFor: clientFor, ttlMs: 5 * 60_000 },
);

/** Full scans are expensive: 6 per minute per client. */
export const approvalRateLimiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

/** Raw JSON-RPC against the regular (non-archive) endpoint; used by the allow-listed browser proxy. */
export function rpcRequest(chain: ChainKey, method: string, params: readonly string[]): Promise<unknown> {
  if (env.DATA_MODE === "fixture") return Promise.resolve(fixtureRpc(chain, method, params));
  return (clientFor(chain) as unknown as { request: (a: { method: string; params: readonly string[] }) => Promise<unknown> }).request({ method, params });
}

/** Transaction tracking polls every few seconds; 120/min per client is ample. */
export const rpcProxyLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
