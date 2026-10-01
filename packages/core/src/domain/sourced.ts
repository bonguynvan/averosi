/**
 * Every externally sourced value carries its origin and fetch time so the UI
 * can always attribute and timestamp it (LEGAL_REGISTER R8).
 */
export interface Sourced<T> {
  readonly data: T;
  readonly source: string;
  readonly fetchedAt: Date;
}

export type Freshness = "fresh" | "stale";

export function sourced<T>(data: T, source: string, fetchedAt: Date): Sourced<T> {
  if (source.trim() === "") throw new Error("source is required");
  return { data, source, fetchedAt };
}

export function freshness(value: Sourced<unknown>, maxAgeMs: number, now: Date): Freshness {
  const ageMs = now.getTime() - value.fetchedAt.getTime();
  return ageMs > maxAgeMs ? "stale" : "fresh";
}
