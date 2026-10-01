import { describe, expect, test } from "vitest";
import { CANDLE_TIMEFRAMES, TIMEFRAME_SECONDS, bucketStart, parseTimeframe } from "../src/domain/candles";

describe("candles domain", () => {
  test("timeframes and their sizes", () => {
    expect(CANDLE_TIMEFRAMES).toEqual(["1m", "5m", "15m", "1h", "1d"]);
    expect(TIMEFRAME_SECONDS["15m"]).toBe(900);
  });

  test("parseTimeframe accepts only supported values", () => {
    expect(parseTimeframe("1h")).toBe("1h");
    expect(parseTimeframe("4h")).toBeNull();
  });

  test("bucketStart aligns to UTC buckets", () => {
    expect(bucketStart(3_725, "1h")).toBe(3_600);
    expect(bucketStart(3_725, "5m")).toBe(3_600);
    expect(bucketStart(90_000, "1d")).toBe(86_400);
  });
});
