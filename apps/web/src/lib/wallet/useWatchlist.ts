"use client";

import type { ChainKey } from "@app/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedWalletView } from "./portfolio";
import { type AddError, STORAGE_KEY, type WatchedWallet, addWallet, markSeen, parseWatchlist, removeWallet, serializeWatchlist } from "./watchlist";

const REFRESH_MS = 60_000;

function load(): WatchedWallet[] {
  try {
    return parseWatchlist(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return []; // storage blocked (private mode, policies): works in-memory for this visit
  }
}

function save(list: readonly WatchedWallet[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeWatchlist(list));
  } catch {
    // ignore: in-memory only
  }
}

export interface WatchState {
  readonly list: readonly WatchedWallet[];
  readonly views: ReadonlyMap<string, SerializedWalletView>;
  readonly loading: boolean;
  readonly error: "RATE_LIMITED" | "UNAVAILABLE" | null;
  readonly updatedAt: number | null;
  readonly vndPerUsd: number | null;
  readonly nativeUsd: ReadonlyMap<string, number>;
}

export const viewKey = (chain: ChainKey, address: string) => `${chain}:${address}`;

/** Watchlist in localStorage + periodic refresh through POST /api/vi (only while the tab is visible). */
export function useWatchlist() {
  const [list, setList] = useState<readonly WatchedWallet[]>([]);
  const [state, setState] = useState<Omit<WatchState, "list">>({ views: new Map(), loading: false, error: null, updatedAt: null, vndPerUsd: null, nativeUsd: new Map() });
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => setList(load()), []);

  const update = useCallback((next: readonly WatchedWallet[]) => {
    setList(next);
    save(next);
  }, []);

  const refresh = useCallback(async () => {
    const current = listRef.current;
    if (current.length === 0) return;
    setState((s) => ({ ...s, loading: true }));
    try {
      const [wallets, market] = await Promise.all([
        fetch("/api/vi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallets: current.map(({ chain, address }) => ({ chain, address })) }) }),
        fetch("/api/thi-truong"),
      ]);
      if (wallets.status === 429) {
        setState((s) => ({ ...s, loading: false, error: "RATE_LIMITED" }));
        return;
      }
      if (!wallets.ok) throw new Error(String(wallets.status));
      const body = (await wallets.json()) as { wallets: SerializedWalletView[] };
      const quotes = market.ok ? ((await market.json()) as { quotes: { symbol: string; priceUsd: number }[]; vndPerUsd: number | null }) : null;
      // First sight of a wallet sets its activity baseline, so "+N mới" only counts what happens after.
      const baseline = body.wallets.flatMap((v) =>
        v.account && listRef.current.some((w) => w.chain === v.chain && w.address === v.address && w.lastTxCount === undefined)
          ? [{ chain: v.chain, address: v.address, txCount: v.account.txCount }]
          : [],
      );
      if (baseline.length > 0) update(markSeen(listRef.current, baseline));
      setState({
        views: new Map(body.wallets.map((v) => [viewKey(v.chain, v.address), v])),
        loading: false,
        error: null,
        updatedAt: Date.now(),
        vndPerUsd: quotes?.vndPerUsd ?? null,
        nativeUsd: new Map((quotes?.quotes ?? []).map((q) => [q.symbol, q.priceUsd])),
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "UNAVAILABLE" }));
    }
  }, [update]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh, list.length]);

  return {
    state: { ...state, list } satisfies WatchState,
    refresh,
    add(input: { chain: string; address: string; note?: string }): AddError | null {
      const result = addWallet(listRef.current, input);
      if (!result.ok) return result.error;
      update(result.value);
      return null;
    },
    remove(chain: ChainKey, address: string) {
      update(removeWallet(listRef.current, chain, address));
    },
    acknowledge(chain: ChainKey, address: string, txCount: number) {
      update(markSeen(listRef.current, [{ chain, address, txCount }]));
    },
  };
}
