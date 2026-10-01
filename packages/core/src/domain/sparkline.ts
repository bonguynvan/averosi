export interface Sparkline {
  /** SVG path data within a width × height box (y grows downward). */
  readonly d: string;
  readonly direction: "up" | "down" | "flat";
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Pure SVG path for a tiny price line; null when there is not enough data to draw honestly. */
export function sparklinePath(values: readonly number[], width: number, height: number): Sparkline | null {
  if (values.length < 2 || values.some((v) => !Number.isFinite(v))) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const step = width / (values.length - 1);
  const y = (v: number) => (span === 0 ? height / 2 : height - ((v - min) / span) * height);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${round(i * step)} ${round(y(v))}`).join("");
  const first = values[0] as number;
  const last = values[values.length - 1] as number;
  return { d, direction: last > first ? "up" : last < first ? "down" : "flat" };
}
