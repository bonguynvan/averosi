const DEFAULT_TIMEOUT_MS = 8_000;

export class HttpStatusError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
  ) {
    super(`${source}: HTTP ${status}`);
  }
}

/** GET JSON with a timeout; non-2xx responses throw HttpStatusError tagged with the source name. */
export async function fetchJson(fetchFn: typeof fetch, source: string, url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
  if (!res.ok) throw new HttpStatusError(source, res.status);
  return res.json();
}

/** Rolling-24h change in basis points from last and open prices (as decimal strings or numbers). */
export function changeBps(last: number, open: number): number | undefined {
  if (!Number.isFinite(last) || !Number.isFinite(open) || open <= 0) return undefined;
  return Math.round(((last - open) / open) * 10_000);
}
