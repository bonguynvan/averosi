import type { Tick } from "@app/core";

/**
 * Server-side realtime tickers (public WebSocket feeds). Only the worker connects to exchanges;
 * browsers receive our own aggregated stream (LEGAL_REGISTER R11).
 */

/** Our assets that Coinbase lists as USD products (TRX is not listed). */
export const COINBASE_LISTED: ReadonlySet<string> = new Set(["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "TON", "AVAX", "LINK", "DOT", "SUI", "LTC"]);

export function coinbaseSubscribe(symbols: readonly string[]) {
  return { type: "subscribe", product_ids: symbols.filter((s) => COINBASE_LISTED.has(s)).map((s) => `${s}-USD`), channels: ["ticker"] };
}

export function krakenSubscribe(symbols: readonly string[]) {
  return { method: "subscribe", params: { channel: "ticker", symbol: symbols.map((s) => `${s}/USD`) } };
}

type Json = Record<string, unknown>;

export function parseCoinbaseTicker(msg: unknown): Tick[] {
  const m = msg as Json;
  if (m?.type !== "ticker" || typeof m.product_id !== "string" || !m.product_id.endsWith("-USD")) return [];
  const price = Number(m.price);
  const at = typeof m.time === "string" ? Date.parse(m.time) : Date.now();
  return [{ symbol: m.product_id.slice(0, -4), source: "Coinbase", price, at }];
}

export function parseKrakenTicker(msg: unknown, receivedAt: number): Tick[] {
  const m = msg as Json;
  if (m?.channel !== "ticker" || !Array.isArray(m.data)) return [];
  return (m.data as Json[]).flatMap((d) =>
    typeof d.symbol === "string" && d.symbol.endsWith("/USD") && typeof d.last === "number"
      ? [{ symbol: d.symbol.slice(0, -4), source: "Kraken", price: d.last, at: receivedAt }]
      : [],
  );
}

export interface TickerStreamOptions {
  readonly name: string;
  readonly url: string;
  readonly subscribe: unknown;
  readonly parse: (msg: unknown, receivedAt: number) => Tick[];
  readonly onTicks: (ticks: Tick[]) => void;
  readonly onStatus?: (status: "open" | "closed", detail?: string) => void;
  readonly WebSocketImpl?: typeof WebSocket;
  /** Reconnect delays; the last value repeats. */
  readonly backoffMs?: readonly number[];
  /** Reconnect if no message arrives for this long (silent half-open sockets). */
  readonly idleTimeoutMs?: number;
}

/** Self-healing WebSocket ticker: reconnects with backoff and an idle watchdog until stop(). */
export function createTickerStream(options: TickerStreamOptions): { stop(): void } {
  const { url, subscribe, parse, onTicks, onStatus, WebSocketImpl = WebSocket, backoffMs = [1_000, 2_000, 5_000, 15_000, 30_000], idleTimeoutMs = 45_000 } = options;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => socket?.close(), idleTimeoutMs);
  };

  const connect = () => {
    if (stopped) return;
    const ws = new WebSocketImpl(url);
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      ws.send(JSON.stringify(subscribe));
      armIdle();
      onStatus?.("open");
    };
    ws.onmessage = (event: MessageEvent) => {
      armIdle();
      let msg: unknown;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const ticks = parse(msg, Date.now());
      if (ticks.length > 0) onTicks(ticks);
    };
    ws.onerror = () => undefined; // onclose follows and handles reconnect
    ws.onclose = () => {
      clearTimeout(idleTimer);
      onStatus?.("closed");
      if (stopped) return;
      const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)] as number;
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();
  return {
    stop() {
      stopped = true;
      clearTimeout(reconnectTimer);
      clearTimeout(idleTimer);
      socket?.close();
    },
  };
}
