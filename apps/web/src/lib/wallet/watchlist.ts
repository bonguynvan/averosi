import { type ChainKey, type Result, err, ok, parseChainKey, parseEvmAddress } from "@app/core";

/**
 * Watched public wallets, stored only in the visitor's browser (localStorage). Notes are the
 * visitor's private labels and never leave the device (LEGAL_REGISTER R6/R7).
 */
export const STORAGE_KEY = "ds-watchlist:v1";
export const MAX_WATCHED = 20;
const MAX_NOTE = 40;

export interface WatchedWallet {
  readonly chain: ChainKey;
  readonly address: string;
  readonly note?: string;
  /** Outgoing tx count when the visitor last looked, to highlight new activity. */
  readonly lastTxCount?: number;
}

/** Hand-rolled validation: this module ships to the browser, so it avoids pulling zod into the bundle. */
function asEntry(item: unknown): { chain: string; address: string; note?: string; lastTxCount?: number } | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.chain !== "string" || typeof o.address !== "string") return null;
  if (o.note !== undefined && (typeof o.note !== "string" || o.note.length > MAX_NOTE)) return null;
  if (o.lastTxCount !== undefined && !(Number.isInteger(o.lastTxCount) && (o.lastTxCount as number) >= 0)) return null;
  return {
    chain: o.chain,
    address: o.address,
    ...(typeof o.note === "string" ? { note: o.note } : {}),
    ...(typeof o.lastTxCount === "number" ? { lastTxCount: o.lastTxCount } : {}),
  };
}

export function parseWatchlist(raw: string | null): WatchedWallet[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const entry = asEntry(item);
    if (!entry) return [];
    const chain = parseChainKey(entry.chain);
    const address = parseEvmAddress(entry.address);
    if (!chain.ok || !address.ok) return [];
    const { note, lastTxCount } = entry;
    return [{ chain: chain.value, address: address.value, ...(note ? { note } : {}), ...(lastTxCount !== undefined ? { lastTxCount } : {}) }];
  }).slice(0, MAX_WATCHED);
}

export const serializeWatchlist = (list: readonly WatchedWallet[]) => JSON.stringify(list);

export type AddError = "UNSUPPORTED_CHAIN" | "INVALID_ADDRESS" | "DUPLICATE" | "FULL";

export function addWallet(list: readonly WatchedWallet[], input: { chain: string; address: string; note?: string }): Result<WatchedWallet[], AddError> {
  const chain = parseChainKey(input.chain);
  if (!chain.ok) return err("UNSUPPORTED_CHAIN");
  const address = parseEvmAddress(input.address);
  if (!address.ok) return err("INVALID_ADDRESS");
  if (list.some((w) => w.chain === chain.value && w.address === address.value)) return err("DUPLICATE");
  if (list.length >= MAX_WATCHED) return err("FULL");
  const note = input.note?.trim().slice(0, MAX_NOTE);
  return ok([...list, { chain: chain.value, address: address.value, ...(note ? { note } : {}) }]);
}

export function removeWallet(list: readonly WatchedWallet[], chain: ChainKey, address: string): WatchedWallet[] {
  return list.filter((w) => !(w.chain === chain && w.address === address));
}

export function markSeen(list: readonly WatchedWallet[], seen: readonly { chain: ChainKey; address: string; txCount: number }[]): WatchedWallet[] {
  return list.map((w) => {
    const s = seen.find((x) => x.chain === w.chain && x.address === w.address);
    return s ? { ...w, lastTxCount: s.txCount } : w;
  });
}
