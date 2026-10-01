/**
 * Vietnamese legal instruments tracked on /phap-ly. Dates are ISO calendar dates in Vietnam time (UTC+7):
 * an instrument is in force from 00:00 on its effective date.
 */
export type LegalStatus = "upcoming" | "in-force" | "expired";

export interface LegalInstrumentDates {
  readonly issuedAt: string;
  readonly effectiveAt: string;
  /** Last day in force, if the instrument has a fixed end. */
  readonly expiresAt?: string | undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Milliseconds at 00:00 Vietnam time on the given ISO date. */
function startOfVnDay(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00+07:00`);
  if (!ISO_DATE.test(iso) || Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  return ms;
}

export function legalStatus(dates: LegalInstrumentDates, now: Date): LegalStatus {
  startOfVnDay(dates.issuedAt);
  const t = now.getTime();
  if (t < startOfVnDay(dates.effectiveAt)) return "upcoming";
  if (dates.expiresAt && t >= startOfVnDay(dates.expiresAt) + DAY_MS) return "expired";
  return "in-force";
}

/** Whole Vietnam calendar days from `now` to `iso` (negative if past). */
export function daysUntil(iso: string, now: Date): number {
  const todayVn = startOfVnDay(new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10));
  return Math.round((startOfVnDay(iso) - todayVn) / DAY_MS);
}

export function sortByEffectiveDesc<T extends LegalInstrumentDates>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.issuedAt.localeCompare(a.issuedAt));
}
