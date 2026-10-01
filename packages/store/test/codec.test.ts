import { describe, expect, test } from "vitest";
import { decode, encode } from "../src/codec";

describe("codec", () => {
  test("round-trips bigint and Date inside nested structures", () => {
    const value = { a: 1n, b: [new Date("2026-10-01T00:00:00Z"), { c: 2n ** 70n }], d: "x", e: null };
    expect(decode(encode(value))).toEqual(value);
  });

  test("plain objects that merely contain $bigint alongside other keys are left alone", () => {
    expect(decode(encode({ $bigint: "1", other: true }))).toEqual({ $bigint: "1", other: true });
  });
});
