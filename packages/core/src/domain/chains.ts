import { type Result, err, ok } from "./result";

export type ChainKey = "ethereum" | "base" | "bsc";

export interface ChainInfo {
  readonly key: ChainKey;
  readonly name: string;
  readonly chainId: number;
  readonly explorer: string;
  readonly nativeSymbol: string;
  readonly nativeDecimals: number;
}

export const SUPPORTED_CHAINS: readonly ChainInfo[] = [
  { key: "ethereum", name: "Ethereum", chainId: 1, explorer: "https://etherscan.io", nativeSymbol: "ETH", nativeDecimals: 18 },
  { key: "base", name: "Base", chainId: 8453, explorer: "https://basescan.org", nativeSymbol: "ETH", nativeDecimals: 18 },
  { key: "bsc", name: "BNB Chain", chainId: 56, explorer: "https://bscscan.com", nativeSymbol: "BNB", nativeDecimals: 18 },
];

export function parseChainKey(input: string): Result<ChainKey, "UNSUPPORTED_CHAIN"> {
  const chain = SUPPORTED_CHAINS.find((c) => c.key === input);
  return chain ? ok(chain.key) : err("UNSUPPORTED_CHAIN");
}

export function chainInfo(key: ChainKey): ChainInfo {
  const chain = SUPPORTED_CHAINS.find((c) => c.key === key);
  if (!chain) throw new Error(`Unknown chain ${key}`);
  return chain;
}

export function explorerAddressUrl(key: ChainKey, address: string): string {
  return `${chainInfo(key).explorer}/address/${address}`;
}
