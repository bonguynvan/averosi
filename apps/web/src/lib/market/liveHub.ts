import type { LivePriceUpdate } from "@app/core";

export type LiveListener = (prices: LivePriceUpdate[]) => void;
type Upstream = (emit: LiveListener) => Promise<() => Promise<void>>;

/**
 * Fan-out for realtime prices: a single upstream subscription per server process, started when the
 * first browser connects and stopped when the last one leaves.
 */
export function createLiveHub(upstream: Upstream) {
  const listeners = new Set<LiveListener>();
  let stopUpstream: Promise<() => Promise<void>> | null = null;

  const broadcast: LiveListener = (prices) => {
    for (const listener of listeners) {
      try {
        listener(prices);
      } catch {
        // One broken connection must not starve the others.
      }
    }
  };

  return {
    async subscribe(listener: LiveListener): Promise<() => Promise<void>> {
      listeners.add(listener);
      stopUpstream ??= upstream(broadcast);
      await stopUpstream;
      return async () => {
        listeners.delete(listener);
        if (listeners.size === 0 && stopUpstream) {
          const stop = await stopUpstream;
          stopUpstream = null;
          await stop();
        }
      };
    },
    size: () => listeners.size,
  };
}
