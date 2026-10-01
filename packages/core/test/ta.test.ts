import { describe, expect, test } from "vitest";
import { atr, bollinger, ema, indicatorSnapshot, macd, rsi, sma } from "../src/domain/ta";

const close = (n: number) => ({ time: n, open: n, high: n + 1, low: n - 1, close: n, volume: 1 });

describe("sma", () => {
  test("aligned with input; null during warm-up", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  test("rejects non-positive periods", () => {
    expect(() => sma([1], 0)).toThrow("period");
  });
});

describe("ema", () => {
  test("seeded with the SMA, then k = 2/(n+1)", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBe(2); // SMA seed
    expect(out[3]).toBeCloseTo(3, 10); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4, 10);
  });

  test("shorter input than period yields only nulls", () => {
    expect(ema([1, 2], 3)).toEqual([null, null]);
  });
});

describe("rsi (Wilder)", () => {
  test("monotonic rise → 100, monotonic fall → 0", () => {
    const up = rsi([1, 2, 3, 4, 5, 6], 3);
    expect(up.slice(0, 3)).toEqual([null, null, null]);
    expect(up[3]).toBe(100);
    expect(rsi([6, 5, 4, 3, 2, 1], 3)[5]).toBe(0);
  });

  test("hand-computed mixed series", () => {
    // changes: +1, -1, +2 → avgGain 1, avgLoss 1/3 → RS 3 → RSI 75
    expect(rsi([10, 11, 10, 12], 3)[3]).toBeCloseTo(75, 10);
  });

  test("flat series → 50", () => {
    expect(rsi([5, 5, 5, 5], 3)[3]).toBe(50);
  });
});

describe("macd", () => {
  test("line = EMA(fast) − EMA(slow); signal and histogram align", () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + i);
    const { line, signal, histogram } = macd(values, 3, 6, 4);
    expect(line[4]).toBeNull();
    expect(line[5]).toBeCloseTo(1.5, 10); // linear series: EMA lag difference = (6-3)/2
    const last = values.length - 1;
    expect(histogram[last]).toBeCloseTo((line[last] ?? 0) - (signal[last] ?? 0), 10);
  });

  test("fast must be shorter than slow", () => {
    expect(() => macd([1, 2, 3], 5, 3, 2)).toThrow("fast");
  });
});

describe("bollinger", () => {
  test("middle = SMA, bands = ±k·σ (population)", () => {
    const b = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
    expect(b.middle[7]).toBe(5);
    expect(b.upper[7]).toBe(9); // σ = 2
    expect(b.lower[7]).toBe(1);
    expect(b.middle[6]).toBeNull();
  });
});

describe("atr (Wilder)", () => {
  test("first value is the mean true range, then smoothed", () => {
    const bars = [close(10), close(11), close(12), close(13)]; // TR = 2, 2, 2 (high-low dominates)
    const out = atr(bars, 2);
    expect(out[0]).toBeNull();
    expect(out[2]).toBe(2);
    expect(out[3]).toBe(2);
  });
});

describe("indicatorSnapshot", () => {
  test("latest values only, null when not enough history", () => {
    const bars = Array.from({ length: 60 }, (_, i) => close(100 + i));
    const snap = indicatorSnapshot(bars);
    expect(snap.close).toBe(159);
    expect(snap.sma20).toBeCloseTo(149.5, 10);
    expect(snap.rsi14).toBe(100);
    expect(snap.bollinger20?.middle).toBeCloseTo(149.5, 10);
    expect(snap.macd?.line).toBeCloseTo(7, 10);
    expect(snap.sma200).toBeNull();
    expect(indicatorSnapshot([]).close).toBeNull();
  });
});
