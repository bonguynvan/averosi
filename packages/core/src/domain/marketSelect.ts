/**
 * Neutral selections for overview highlights. Deliberately no "top gainers": ranking by absolute
 * movement shows rises and falls side by side (LEGAL_REGISTER R4, no promotional framing).
 */
interface Selectable {
  readonly symbol: string;
  readonly volume24hUsdMicros: bigint;
  readonly change24hBps: number | null;
}

export function topByVolume<T extends Selectable>(assets: readonly T[], n: number): T[] {
  return [...assets].sort((x, y) => (y.volume24hUsdMicros > x.volume24hUsdMicros ? 1 : y.volume24hUsdMicros < x.volume24hUsdMicros ? -1 : 0)).slice(0, n);
}

export function topByAbsChange<T extends Selectable>(assets: readonly T[], n: number): T[] {
  return assets
    .flatMap((x) => (x.change24hBps === null ? [] : [{ item: x, move: Math.abs(x.change24hBps) }]))
    .sort((x, y) => y.move - x.move)
    .slice(0, n)
    .map((x) => x.item);
}

export function totalVolume(assets: readonly Selectable[]): bigint {
  return assets.reduce((sum, x) => sum + x.volume24hUsdMicros, 0n);
}
