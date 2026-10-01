import { describe, expect, test } from "vitest";
import { TRANSFER_TAX_RATE_BPS, estimateTransferTax } from "../src/domain/tax";

describe("estimateTransferTax (0.1% per transfer, Thông tư 32/BTC)", () => {
  test("rate is 10 basis points", () => {
    expect(TRANSFER_TAX_RATE_BPS).toBe(10n);
  });

  test("computes 0.1% of transfer value", () => {
    expect(estimateTransferTax(100_000_000n)).toEqual({ ok: true, value: { taxVnd: 100_000n, netVnd: 99_900_000n } });
  });

  test("rounds half up to the nearest dong", () => {
    expect(estimateTransferTax(1_500n)).toEqual({ ok: true, value: { taxVnd: 2n, netVnd: 1_498n } });
    expect(estimateTransferTax(1_499n)).toEqual({ ok: true, value: { taxVnd: 1n, netVnd: 1_498n } });
  });

  test("zero value yields zero tax", () => {
    expect(estimateTransferTax(0n)).toEqual({ ok: true, value: { taxVnd: 0n, netVnd: 0n } });
  });

  test("rejects negative values", () => {
    expect(estimateTransferTax(-1n)).toEqual({ ok: false, error: "NEGATIVE" });
  });
});
