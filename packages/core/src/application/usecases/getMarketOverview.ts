import { type AssetSnapshot, type SourceQuote, aggregateQuotes, usdMicrosToVnd } from "../../domain/market";
import type { Vnd } from "../../domain/money";
import type { FxSource, MarketSource } from "../ports";
import type { SourceStatus } from "./checkAddressRisk";

export interface MarketOverviewDeps {
  readonly sources: readonly MarketSource[];
  readonly fx: FxSource;
}

export interface MarketAsset extends AssetSnapshot {
  readonly priceVnd: Vnd | null;
  readonly volume24hVnd: Vnd | null;
}

export type FxStatus =
  | { readonly status: "ok"; readonly rateVnd: Vnd; readonly source: string; readonly fetchedAt: Date }
  | { readonly status: "failed" };

export interface MarketOverview {
  readonly assets: readonly MarketAsset[];
  readonly fx: FxStatus;
  readonly sources: readonly SourceStatus[];
}

async function loadFx(fx: FxSource): Promise<FxStatus> {
  try {
    const rate = await fx.usdVndRate();
    return { status: "ok", rateVnd: rate.data, source: rate.source, fetchedAt: rate.fetchedAt };
  } catch {
    return { status: "failed" };
  }
}

/** Reference prices only. A failing exchange drops out; a missing FX rate yields null VND, never a guess. */
export async function getMarketOverview(deps: MarketOverviewDeps, query: { readonly symbols: readonly string[] }): Promise<MarketOverview> {
  const [fx, ...results] = await Promise.all([loadFx(deps.fx), ...deps.sources.map((s) => s.quotes(query.symbols).then((r) => r, () => null))]);

  const quotes: SourceQuote[] = results.flatMap((r) => (r ? [...r.data] : []));
  const sources: SourceStatus[] = deps.sources.map((s, i) => {
    const r = results[i];
    return r ? { name: s.name, status: "ok", fetchedAt: r.fetchedAt } : { name: s.name, status: "failed" };
  });

  const toVnd = (usdMicros: bigint): Vnd | null => (fx.status === "ok" ? usdMicrosToVnd(usdMicros, fx.rateVnd) : null);
  const assets = aggregateQuotes(query.symbols, quotes).map((a) => ({
    ...a,
    priceVnd: toVnd(a.priceUsdMicros),
    volume24hVnd: toVnd(a.volume24hUsdMicros),
  }));

  return { assets, fx, sources };
}
