/**
 * JSON codec that round-trips bigint and Date (Redis payloads, SSE). Tagged objects keep it unambiguous:
 * {"$bigint":"123"} and {"$date":"2026-10-01T00:00:00.000Z"}.
 */
export function encode(value: unknown): string {
  return JSON.stringify(value, function (key, v: unknown) {
    const raw = (this as Record<string, unknown>)[key];
    if (typeof v === "bigint") return { $bigint: v.toString() };
    if (raw instanceof Date) return { $date: raw.toISOString() };
    return v;
  });
}

export function decode<T>(text: string): T {
  return JSON.parse(text, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 1 && typeof o.$bigint === "string") return BigInt(o.$bigint);
      if (keys.length === 1 && typeof o.$date === "string") return new Date(o.$date);
    }
    return v;
  }) as T;
}
