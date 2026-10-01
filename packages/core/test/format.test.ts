import { describe, expect, test } from "vitest";
import { formatBps, formatUsdMicros, formatVndCompact } from "../src/domain/format";

describe("formatVndCompact", () => {
  test("uses nghìn tỷ / tỷ / triệu with one decimal (vi-VN comma)", () => {
    expect(formatVndCompact(2_152_575_604_000_000n)).toBe("2.152,6 nghìn tỷ ₫");
    expect(formatVndCompact(64_820_000_000_000n)).toBe("64,8 nghìn tỷ ₫");
    expect(formatVndCompact(2_140_000_000n)).toBe("2,1 tỷ ₫");
    expect(formatVndCompact(86_420_000n)).toBe("86,4 triệu ₫");
    expect(formatVndCompact(950_000n)).toBe("950.000 ₫");
  });
});

describe("formatUsdMicros", () => {
  test("2 decimals for >= $1, up to 6 significant decimals below", () => {
    expect(formatUsdMicros(83_497_890_000n)).toBe("$83.497,89");
    expect(formatUsdMicros(1_500_000n)).toBe("$1,50");
    expect(formatUsdMicros(94_424n)).toBe("$0,094424");
    expect(formatUsdMicros(0n)).toBe("$0,00");
  });
});

describe("formatBps", () => {
  test("signed percent with two decimals", () => {
    expect(formatBps(125)).toBe("+1,25%");
    expect(formatBps(-14)).toBe("-0,14%");
    expect(formatBps(0)).toBe("0,00%");
  });
});
