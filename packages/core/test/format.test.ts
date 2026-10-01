import { describe, expect, test } from "vitest";
import { formatBps, formatUsdNanos, formatVndCompact, formatVndFromUsd, formatVndPrice } from "../src/domain/format";

describe("formatVndCompact", () => {
  test("uses nghìn tỷ / tỷ / triệu with one decimal (vi-VN comma)", () => {
    expect(formatVndCompact(2_152_575_604_000_000n)).toBe("2.152,6 nghìn tỷ ₫");
    expect(formatVndCompact(64_820_000_000_000n)).toBe("64,8 nghìn tỷ ₫");
    expect(formatVndCompact(2_140_000_000n)).toBe("2,1 tỷ ₫");
    expect(formatVndCompact(86_420_000n)).toBe("86,4 triệu ₫");
    expect(formatVndCompact(950_000n)).toBe("950.000 ₫");
  });
});

describe("formatUsdNanos", () => {
  test("2 decimals for >= $1, 4 significant digits below", () => {
    expect(formatUsdNanos(83_497_890_000_000n)).toBe("$83.497,89");
    expect(formatUsdNanos(1_500_000_000n)).toBe("$1,50");
    expect(formatUsdNanos(999_999_999n)).toBe("$1");
    expect(formatUsdNanos(94_424_700n)).toBe("$0,09442");
    expect(formatUsdNanos(700_000_000n)).toBe("$0,7");
    expect(formatUsdNanos(12_345n)).toBe("$0,00001235"); // SHIB-like, rounded half up
    expect(formatUsdNanos(1n)).toBe("$0,000000001");
    expect(formatUsdNanos(0n)).toBe("$0,00");
  });
});

describe("formatVndPrice", () => {
  const nano = 1_000_000_000n;
  test("whole dong from 1.000 ₫, two decimals from 1 ₫, significant digits below", () => {
    expect(formatVndPrice(2_152_630_000n * nano)).toBe("2.152.630.000 ₫");
    expect(formatVndPrice(1_000n * nano)).toBe("1.000 ₫");
    expect(formatVndPrice(999_995_000_000n)).toBe("1.000,00 ₫"); // 999,995 ₫ rounds up within the 2-decimal band
    expect(formatVndPrice(23_456_000_000n)).toBe("23,46 ₫");
    expect(formatVndPrice(231_234_567n)).toBe("0,2312 ₫");
    expect(formatVndPrice(0n)).toBe("0,00 ₫");
  });

  test("from USD nanos and the bank rate (exact nano-dong product)", () => {
    expect(formatVndFromUsd(9_000n, 26_000n)).toBe("0,234 ₫"); // PEPE ≈ $0.000009
    expect(formatVndFromUsd(83_500_000_000_000n, 25_780n)).toBe("2.152.630.000 ₫");
  });
});


describe("formatBps", () => {
  test("signed percent with two decimals", () => {
    expect(formatBps(125)).toBe("+1,25%");
    expect(formatBps(-14)).toBe("-0,14%");
    expect(formatBps(0)).toBe("0,00%");
  });
});
