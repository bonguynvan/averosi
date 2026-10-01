/**
 * In-memory sliding-window limiter (single VPS process). Keys (client IPs) are dropped as soon as
 * their window expires, matching the privacy policy's "short-lived, anti-abuse only" promise.
 */
export interface RateLimiter {
  take(key: string): boolean;
  size(): number;
}

export interface RateLimiterOptions {
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions): RateLimiter {
  let hits = new Map<string, readonly number[]>();

  const prune = (t: number) => {
    hits = new Map(
      [...hits].map(([k, times]) => [k, times.filter((x) => t - x < windowMs)] as const).filter(([, times]) => times.length > 0),
    );
  };

  return {
    take(key) {
      const t = now();
      prune(t);
      const recent = hits.get(key) ?? [];
      if (recent.length >= limit) return false;
      hits = new Map(hits).set(key, [...recent, t]);
      return true;
    },
    size: () => hits.size,
  };
}
