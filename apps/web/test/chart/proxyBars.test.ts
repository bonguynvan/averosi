import { describe, expect, test, vi } from "vitest";
import { fetchProxyBars, isProxyTimeframe } from "@/lib/chart/proxyBars";

const bar = (time: number) => ({ time, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });

describe("fetchProxyBars", () => {
  test("calls the same-origin proxy and returns the last `limit` bars", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ source: "Coinbase", bars: [bar(1), bar(2), bar(3)] })));
    const bars = await fetchProxyBars(fetchFn, "BTC", "15m", 2);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("/api/nen/BTC?tf=15m");
    expect(bars.map((b) => b.time)).toEqual([2, 3]);
  });

  test("rejects unsupported timeframes before any request", async () => {
    const fetchFn = vi.fn();
    await expect(fetchProxyBars(fetchFn, "BTC", "4h", 10)).rejects.toThrow("Unsupported timeframe 4h");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(isProxyTimeframe("1d")).toBe(true);
  });

  test("surfaces HTTP and shape errors", async () => {
    await expect(fetchProxyBars(async () => new Response("{}", { status: 429 }), "BTC", "1h", 5)).rejects.toThrow("HTTP 429");
    await expect(fetchProxyBars(async () => new Response("{}"), "BTC", "1h", 5)).rejects.toThrow("malformed");
  });

  test("encodes the symbol", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ bars: [] })));
    await fetchProxyBars(fetchFn, "a/b", "1h", 5);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("/api/nen/a%2Fb?tf=1h");
  });
});
