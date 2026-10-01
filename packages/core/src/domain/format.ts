import { formatVnd } from "./money";

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

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * A value below one unit (`value` < 10^decimals) with `significant` significant digits, trailing
 * zeros trimmed, vi-VN comma: 94_424n (9 decimals) → "0,00009442". Rounds half up.
 */
function belowOne(value: bigint, decimals: number, significant: number): string {
  const digits = value.toString().padStart(decimals, "0");
  const keep = Math.min(decimals, digits.search(/[1-9]/) + significant);
  const scale = 10n ** BigInt(decimals - keep);
  const rounded = (value + scale / 2n) / scale;
  if (rounded >= 10n ** BigInt(keep)) return "1";
  return `0,${rounded.toString().padStart(keep, "0").replace(/0+$/, "")}`;
}

/** Fixed `places` decimals, half up, grouped: 2_345_000_000n (9 decimals, 2 places) → "2,35". */
function fixed(value: bigint, decimals: number, places: number): string {
  const scale = 10n ** BigInt(decimals - places);
  const rounded = (value + scale / 2n) / scale;
  const unit = 10n ** BigInt(places);
  return `${group((rounded / unit).toString())},${(rounded % unit).toString().padStart(places, "0")}`;
}

const USD_DECIMALS = 9;
const SIGNIFICANT = 4;

/** USD from nano-units in vi-VN notation: "$83.497,89", "$0,7012", "$0,00001234". */
export function formatUsdNanos(nanos: bigint): string {
  if (nanos >= 10n ** BigInt(USD_DECIMALS) || nanos === 0n) return `$${fixed(nanos, USD_DECIMALS, 2)}`;
  return `$${belowOne(nanos, USD_DECIMALS, SIGNIFICANT)}`;
}

/**
 * A VND price from nano-dong (USD nanos × whole-dong rate is exactly nano-dong):
 * ≥ 1.000 ₫ → whole dong; 1–1.000 ₫ → 2 decimals; below 1 ₫ → 4 significant digits.
 */
export function formatVndPrice(nanoVnd: bigint): string {
  const unit = 10n ** BigInt(USD_DECIMALS);
  if (nanoVnd >= 1_000n * unit) return formatVnd((nanoVnd + unit / 2n) / unit);
  if (nanoVnd >= unit || nanoVnd === 0n) return `${fixed(nanoVnd, USD_DECIMALS, 2)} ₫`;
  return `${belowOne(nanoVnd, USD_DECIMALS, SIGNIFICANT)} ₫`;
}

/** Display price in VND for a USD nano-unit price and a whole-dong rate. */
export const formatVndFromUsd = (usdNanos: bigint, vndPerUsd: bigint): string => formatVndPrice(usdNanos * vndPerUsd);

/** Basis points as a signed percentage: 125 → "+1,25%". */
export function formatBps(bps: number): string {
  const sign = bps > 0 ? "+" : bps < 0 ? "-" : "";
  const abs = Math.abs(bps);
  return `${sign}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, "0")}%`;
}
