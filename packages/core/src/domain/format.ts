import { formatVnd } from "./money";
import { formatUnits } from "./units";

const UNITS: readonly { readonly size: bigint; readonly label: string }[] = [
  { size: 1_000_000_000_000n, label: "nghìn tỷ" },
  { size: 1_000_000_000n, label: "tỷ" },
  { size: 1_000_000n, label: "triệu" },
];

function oneDecimal(amount: bigint, size: bigint): string {
  const tenths = (amount * 10n + size / 2n) / size;
  const whole = (tenths / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${whole},${tenths % 10n}`;
}

/** Large VND amounts for tables: "2,1 tỷ ₫", "64,8 nghìn tỷ ₫". */
export function formatVndCompact(amount: bigint): string {
  const unit = UNITS.find((u) => amount >= u.size);
  return unit ? `${oneDecimal(amount, unit.size)} ${unit.label} ₫` : formatVnd(amount);
}

/** USD from micro-units in vi-VN notation: "$83.497,89", "$0,094424". */
export function formatUsdMicros(micros: bigint): string {
  if (micros >= 1_000_000n || micros === 0n) {
    const cents = (micros + 5_000n) / 10_000n;
    const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `$${whole},${(cents % 100n).toString().padStart(2, "0")}`;
  }
  return `$${formatUnits(micros, 6, 6)}`;
}

/** Basis points as a signed percentage: 125 → "+1,25%". */
export function formatBps(bps: number): string {
  const sign = bps > 0 ? "+" : bps < 0 ? "-" : "";
  const abs = Math.abs(bps);
  return `${sign}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, "0")}%`;
}
