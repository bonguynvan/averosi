import { type FxSource, type MarketSource, sourced } from "@app/core";
import type { CandleSource } from "@app/market-data";

/** Deterministic offline market data for e2e tests (DATA_MODE=fixture). Never enabled by default. */
const AT = new Date("2026-10-01T08:00:00Z");
const BASE_PRICE_USD: Record<string, number> = { BTC: 83_500, ETH: 2_700, DOGE: 0.0944 };

function fixtureSource(name: string, skew: number): MarketSource {
  return {
    name,
    quotes: async (symbols) =>
      sourced(
        symbols.map((symbol) => {
          const usd = (BASE_PRICE_USD[symbol] ?? 10) * skew;
          return {
            source: name,
            symbol,
            lastUsdMicros: BigInt(Math.round(usd * 1_000_000)),
            change24hBps: symbol === "ETH" ? -120 : 85,
            volume24hBaseMicros: 1_000_000_000n,
          };
        }),
        name,
        AT,
      ),
  };
}

export const FIXTURE_MARKET_SOURCES: readonly MarketSource[] = [
  fixtureSource("Coinbase", 1.001),
  fixtureSource("Kraken", 1),
  fixtureSource("Bitstamp", 0.999),
  { name: "Gemini", quotes: async () => Promise.reject(new Error("fixture outage")) },
];

export const FIXTURE_FX: FxSource = { usdVndRate: async () => sourced(25_780n, "Vietcombank (USD chuyển khoản)", AT) };

export const FIXTURE_CANDLES: CandleSource = {
  candles: async () => ({
    source: "Coinbase",
    bars: Array.from({ length: 48 }, (_, i) => {
      const open = 83_000 + Math.sin(i / 4) * 600;
      const close = 83_000 + Math.sin((i + 1) / 4) * 600;
      return { time: 1_790_000_000 + i * 3_600, open, close, high: Math.max(open, close) + 120, low: Math.min(open, close) - 120, volume: 50 + i };
    }),
  }),
};

