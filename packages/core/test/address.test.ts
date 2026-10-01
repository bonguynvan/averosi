import { describe, expect, test } from "vitest";
import { parseEvmAddress } from "../src/domain/address";

describe("parseEvmAddress", () => {
  test("accepts and lowercases a valid address", () => {
    expect(parseEvmAddress("  0xAbCdEf0123456789abcdef0123456789ABCDEF01 ")).toEqual({
      ok: true,
      value: "0xabcdef0123456789abcdef0123456789abcdef01",
    });
  });

  test("rejects wrong length, missing prefix and non-hex", () => {
    expect(parseEvmAddress("0x1234")).toEqual({ ok: false, error: "INVALID_ADDRESS" });
    expect(parseEvmAddress("abcdef0123456789abcdef0123456789abcdef01")).toEqual({ ok: false, error: "INVALID_ADDRESS" });
    expect(parseEvmAddress("0xZZcdef0123456789abcdef0123456789abcdef01")).toEqual({ ok: false, error: "INVALID_ADDRESS" });
  });
});
