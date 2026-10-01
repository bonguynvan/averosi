import "server-only";
import type { ChainKey } from "@app/core";
import { type Chain, createPublicClient, http } from "viem";
import { base, bsc, mainnet } from "viem/chains";
import { z } from "zod";
import { type RpcClient, createChainReader } from "./chainReader";
import { type MulticallClient, createTokenReader, createWalletService } from "../wallet/portfolio";
import { FIXTURE_TOKENS, createFixtureDeps } from "./fixtures";
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
});

const env = EnvSchema.parse({
  DATA_MODE: process.env.DATA_MODE || undefined,
  RPC_URL_ETHEREUM: process.env.RPC_URL_ETHEREUM || undefined,
  RPC_URL_BASE: process.env.RPC_URL_BASE || undefined,
  RPC_URL_BSC: process.env.RPC_URL_BSC || undefined,
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
