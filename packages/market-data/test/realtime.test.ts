import { describe, expect, test, vi } from "vitest";
import { COINBASE_LISTED, coinbaseSubscribe, createTickerStream, krakenSubscribe, parseCoinbaseTicker, parseKrakenTicker } from "../src/realtime";

describe("parsers", () => {
  test("Coinbase ticker → tick (product id → symbol, ISO time → ms)", () => {
    const msg = { type: "ticker", product_id: "BTC-USD", price: "83737.93", time: "2026-10-01T10:36:06.000Z" };
    expect(parseCoinbaseTicker(msg)).toEqual([{ symbol: "BTC", source: "Coinbase", price: 83737.93, at: Date.parse("2026-10-01T10:36:06.000Z") }]);
    expect(parseCoinbaseTicker({ type: "subscriptions" })).toEqual([]);
    expect(parseCoinbaseTicker({ type: "ticker", product_id: "BTC-EUR", price: "1" })).toEqual([]);
  });

  test("Kraken v2 ticker snapshot/update → ticks (uses receive time when absent)", () => {
    const msg = { channel: "ticker", type: "update", data: [{ symbol: "DOGE/USD", last: 0.0943026 }, { symbol: "BTC/EUR", last: 1 }] };
    expect(parseKrakenTicker(msg, 42)).toEqual([{ symbol: "DOGE", source: "Kraken", price: 0.0943026, at: 42 }]);
    expect(parseKrakenTicker({ channel: "status", type: "update", data: [] }, 1)).toEqual([]);
    expect(parseKrakenTicker({ method: "subscribe", success: true }, 1)).toEqual([]);
  });

  test("subscribe messages; Coinbase skips assets it does not list", () => {
    expect(COINBASE_LISTED.has("TRX")).toBe(false);
    expect(coinbaseSubscribe(["BTC", "TRX"])).toEqual({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] });
    expect(krakenSubscribe(["BTC", "DOGE"])).toEqual({ method: "subscribe", params: { channel: "ticker", symbol: ["BTC/USD", "DOGE/USD"] } });
  });
});

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

describe("createTickerStream", () => {
  test("subscribes on open, parses messages, reconnects with backoff after close, stops cleanly", () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const ticks: unknown[] = [];
    const stream = createTickerStream({
      name: "Test",
      url: "wss://x",
      subscribe: { hello: 1 },
      parse: (msg) => [{ symbol: "BTC", source: "Test", price: (msg as { p: number }).p, at: 0 }],
      onTicks: (t) => ticks.push(...t),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      backoffMs: [100, 200],
      idleTimeoutMs: 10_000,
    });

    const first = FakeSocket.instances[0] as FakeSocket;
    first.onopen?.();
    expect(first.sent).toEqual([JSON.stringify({ hello: 1 })]);
    first.onmessage?.({ data: JSON.stringify({ p: 5 }) });
    first.onmessage?.({ data: "not json" }); // ignored
    expect(ticks).toHaveLength(1);

    first.onclose?.();
    vi.advanceTimersByTime(99);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    // Idle watchdog: no messages for idleTimeoutMs → force reconnect.
    const second = FakeSocket.instances[1] as FakeSocket;
    second.onopen?.();
    vi.advanceTimersByTime(10_000);
    expect(second.closed).toBe(true);

    stream.stop();
    const count = FakeSocket.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(count);
    vi.useRealTimers();
  });
});
