"use client";

import { base, bsc, mainnet } from "viem/chains";
import { createConfig, fallback, http, injected, unstable_connector } from "wagmi";

/**
 * Wallet connection is read-only: we learn the visitor's address and network, nothing else.
 * Browser-side reads go through the visitor's own wallet (unstable_connector); when that wallet only
 * announces via EIP-6963 (no window.ethereum), they fall back to our same-origin, allow-listed proxy
 * (/api/rpc/[chain]). The browser never contacts a third-party RPC or exchange (R11 spirit).
 */
export const SUPPORTED_WALLET_CHAINS = [mainnet, base, bsc] as const;

export const wagmiConfig = createConfig({
  chains: SUPPORTED_WALLET_CHAINS,
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true, // EIP-6963: MetaMask, Rabby, Coin98, Trust, …
  ssr: true,
  transports: {
    [mainnet.id]: fallback([unstable_connector(injected), http("/api/rpc/ethereum")]),
    [base.id]: fallback([unstable_connector(injected), http("/api/rpc/base")]),
    [bsc.id]: fallback([unstable_connector(injected), http("/api/rpc/bsc")]),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

/** Our ChainKey for a wallet chain id, or null when unsupported. */
export function chainKeyForId(chainId: number | undefined): "ethereum" | "base" | "bsc" | null {
  return chainId === mainnet.id ? "ethereum" : chainId === base.id ? "base" : chainId === bsc.id ? "bsc" : null;
}
