/** Decimals for chart price labels: cents from $1, otherwise 4 significant digits ($0.000004343). */
const MAX_DECIMALS = 10;
const SIGNIFICANT = 4;

export function pricePrecisionFor(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 2;
  if (price >= 1) return 2;
  return Math.min(MAX_DECIMALS, Math.max(2, Math.ceil(-Math.log10(price)) + SIGNIFICANT - 1));
}
