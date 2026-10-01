import { type AddressListSource, type EvmAddress, parseEvmAddress, sourced } from "@app/core";
import { z } from "zod";

export interface RemoteAddressListOptions {
  readonly name: string;
  /** URL of a JSON array of addresses. */
  readonly url: string;
  readonly ttlMs: number;
  readonly fetchFn?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

interface Snapshot {
  readonly addresses: ReadonlySet<string>;
  readonly fetchedAt: Date;
}

const ListSchema = z.array(z.unknown());
const DEFAULT_TIMEOUT_MS = 8_000;

function toAddressSet(entries: readonly unknown[]): ReadonlySet<string> {
  return new Set(
    entries.flatMap((e) => {
      if (typeof e !== "string") return [];
      const parsed = parseEvmAddress(e);
      return parsed.ok ? [parsed.value] : [];
    }),
  );
}

/**
 * Public address list fetched over HTTP and cached in memory. On refresh failure the last good copy is
 * served with its original timestamp, so the UI shows real staleness instead of pretending it is fresh.
 */
export function createRemoteAddressList(options: RemoteAddressListOptions): AddressListSource {
  const { name, url, ttlMs, fetchFn = fetch, now = () => new Date(), timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let snapshot: Snapshot | null = null;
  let inFlight: Promise<Snapshot> | null = null;

  const download = async (): Promise<Snapshot> => {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    const entries = ListSchema.parse(await res.json());
    return { addresses: toAddressSet(entries), fetchedAt: now() };
  };

  const current = async (): Promise<Snapshot> => {
    const isFresh = snapshot !== null && now().getTime() - snapshot.fetchedAt.getTime() < ttlMs;
    if (isFresh && snapshot) return snapshot;
    inFlight ??= download().finally(() => {
      inFlight = null;
    });
    try {
      snapshot = await inFlight;
      return snapshot;
    } catch (error) {
      if (snapshot) return snapshot;
      throw error;
    }
  };

  return {
    name,
    async contains(address: EvmAddress) {
      const { addresses, fetchedAt } = await current();
      return sourced(addresses.has(address), name, fetchedAt);
    },
  };
}
