"use client";

import { base, bsc, mainnet } from "viem/chains";
import { createConfig, injected, unstable_connector } from "wagmi";

/**
 * Wallet connection is read-only: we learn the visitor's address and network, nothing else.
 * Any browser-side RPC goes through the visitor's own wallet (unstable_connector), so connecting
 * never makes the browser contact a third-party RPC or exchange (R11 spirit).
 */
export const SUPPORTED_WALLET_CHAINS = [mainnet, base, bsc] as const;

export const wagmiConfig = createConfig({
  chains: SUPPORTED_WALLET_CHAINS,
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true, // EIP-6963: MetaMask, Rabby, Coin98, Trust, …
  ssr: true,
  transports: {
    [mainnet.id]: unstable_connector(injected),
    [base.id]: unstable_connector(injected),
    [bsc.id]: unstable_connector(injected),
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
