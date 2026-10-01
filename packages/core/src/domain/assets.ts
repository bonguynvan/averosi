/**
 * Asset universe. The live universe is discovered from exchanges' public product catalogs (worker,
 * daily); `MARKET_ASSETS` is the small seed used for names, fixtures and when no registry exists yet.
 */
export interface AssetInfo {
  readonly symbol: string;
  readonly name: string;
}

/** An asset in the discovered universe: listed against USD (fiat) on `sources`. */
export interface UniverseAsset extends AssetInfo {
  readonly sources: readonly string[];
  /** Exchange-specific product ids (e.g. Coinbase "BTC-USD", Kraken "XBTUSD"), keyed by source name. */
  readonly venues: Readonly<Record<string, string>>;
}

/** One USD (fiat) product as listed by one exchange. */
export interface Listing {
  readonly source: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly name?: string;
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

/** Ticker format we accept anywhere (URLs, catalogs): upper-case letters/digits, 1–12 chars. */
export const SYMBOL_PATTERN = /^[A-Z0-9]{1,12}$/;

export function parseSymbol(input: string): string | null {
  const symbol = input.trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : null;
}

/** Exchange-legacy tickers → common tickers. */
const ALIASES: Readonly<Record<string, string>> = { XBT: "BTC", XDG: "DOGE" };

export function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return ALIASES[upper] ?? upper;
}

/**
 * Never part of the universe (LEGAL_REGISTER R2, R11):
 * - stablecoins and other fiat-pegged tokens: a "USDT = x VNĐ" figure is a P2P/OTC-style rate;
 * - fiat currencies themselves (EUR/USD, GBP/USD): our only FX source is the published bank rate;
 * - gold-backed tokens: gold trading is separately regulated in Vietnam.
 * Pattern rule first (anything named *USD*, EUR*), then an explicit list for the rest.
 */
const EXCLUDED_PATTERN = /USD|^EUR/;
const EXCLUDED: ReadonlySet<string> = new Set([
  "EUR", "GBP", "AUD", "CAD", "CHF", "JPY", "SGD", "AED",
  "DAI", "FRAX", "LUSD", "GHO", "MIM", "UST", "USTC", "PAX", "AUDX", "XSGD", "BRZ", "TRYB", "MXNB", "IDRT",
  "PAXG", "XAUT", "KAU", "KAG",
]);

export function isExcludedAsset(symbol: string): boolean {
  return EXCLUDED.has(symbol) || EXCLUDED_PATTERN.test(symbol);
}

const SEED_NAMES: ReadonlyMap<string, string> = new Map(MARKET_ASSETS.map((a) => [a.symbol, a.name]));

/**
 * Builds the universe from exchange listings: valid, non-excluded tickers listed on at least
 * `minSources` distinct exchanges. Names prefer the seed list, then the first exchange that names it.
 */
export function buildUniverse(listings: readonly Listing[], opts: { readonly minSources: number }): UniverseAsset[] {
  const bySymbol = new Map<string, { names: string[]; venues: Record<string, string> }>();
  for (const l of listings) {
    const symbol = normalizeSymbol(l.symbol);
    if (!SYMBOL_PATTERN.test(symbol) || isExcludedAsset(symbol)) continue;
    const entry = bySymbol.get(symbol) ?? { names: [], venues: {} };
    bySymbol.set(symbol, {
      names: l.name ? [...entry.names, l.name] : entry.names,
      venues: entry.venues[l.source] ? entry.venues : { ...entry.venues, [l.source]: l.venueId },
    });
  }
  return [...bySymbol.entries()]
    .filter(([, e]) => Object.keys(e.venues).length >= opts.minSources)
    .map(([symbol, e]) => ({
      symbol,
      name: SEED_NAMES.get(symbol) ?? e.names.find((n) => n.trim().length > 0)?.trim() ?? symbol,
      sources: Object.keys(e.venues).sort(),
      venues: e.venues,
    }))
    .sort((a, b) => b.sources.length - a.sources.length || a.symbol.localeCompare(b.symbol));
}
