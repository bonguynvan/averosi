import { CANDLE_TIMEFRAMES, type Timeframe } from "../market/candles";

export interface ProxyBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function isProxyTimeframe(tf: string): tf is Timeframe {
  return (CANDLE_TIMEFRAMES as readonly string[]).includes(tf);
}

/**
 * Bars for the chart terminal, always via our same-origin proxy (/api/nen) — the visitor's
 * browser never contacts an exchange (LEGAL_REGISTER R11). Returns the last `limit` bars, ascending.
 */
export async function fetchProxyBars(fetchFn: typeof fetch, symbol: string, timeframe: string, limit: number): Promise<ProxyBar[]> {
  if (!isProxyTimeframe(timeframe)) throw new Error(`Unsupported timeframe ${timeframe}`);
  const res = await fetchFn(`/api/nen/${encodeURIComponent(symbol)}?tf=${timeframe}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Candle proxy: HTTP ${res.status}`);
  const body = (await res.json()) as { bars?: ProxyBar[] };
  if (!Array.isArray(body.bars)) throw new Error("Candle proxy: malformed response");
  return body.bars.slice(-Math.max(1, limit)).map((b) => ({ ...b }));
}
