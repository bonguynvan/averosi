const DEFAULT_MAX_FRACTION = 6;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formats a base-unit token amount (e.g. wei) in Vietnamese notation: "1.234.567,5".
 * Truncates to `maxFraction` digits — never rounds up a balance.
 */
export function formatUnits(amount: bigint, decimals: number, maxFraction = DEFAULT_MAX_FRACTION): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error(`Invalid decimals: ${decimals}`);
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const fraction = (abs % scale).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");

  if (whole === 0n && fraction === "" && abs > 0n) {
    return `<0,${"0".repeat(Math.max(0, maxFraction - 1))}1`;
  }
  const body = groupThousands(whole.toString()) + (fraction ? `,${fraction}` : "");
  return negative ? `-${body}` : body;
}
