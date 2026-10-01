/** Assets with USD fiat pairs on at least three of the aggregated exchanges (verified 2026-10-01). */
export interface AssetInfo {
  readonly symbol: string;
  readonly name: string;
}

export const MARKET_ASSETS: readonly AssetInfo[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "TRX", name: "TRON" },
  { symbol: "TON", name: "Toncoin" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "SUI", name: "Sui" },
  { symbol: "LTC", name: "Litecoin" },
];

export function findAsset(symbol: string): AssetInfo | undefined {
  return MARKET_ASSETS.find((a) => a.symbol === symbol.toUpperCase());
}
