/** Tiny in-process TTL cache with single-flight loads. Failures are not cached. */
export interface TtlCache {
  get<T>(key: string, load: () => Promise<T>): Promise<T>;
}

export function createTtlCache({ ttlMs, now = Date.now }: { ttlMs: number; now?: () => number }): TtlCache {
  let entries = new Map<string, { readonly at: number; readonly value: unknown }>();
  const inFlight = new Map<string, Promise<unknown>>();

  return {
    async get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value as T;

      const pending = inFlight.get(key);
      if (pending) return pending as Promise<T>;

      const promise = load()
        .then((value) => {
          entries = new Map(entries).set(key, { at: now(), value });
          return value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
  };
}
