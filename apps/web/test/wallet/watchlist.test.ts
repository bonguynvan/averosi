import { describe, expect, test } from "vitest";
import { MAX_WATCHED, addWallet, markSeen, parseWatchlist, removeWallet, serializeWatchlist } from "@/lib/wallet/watchlist";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";

describe("watchlist (browser storage, never sent to the server as a list)", () => {
  test("parses stored JSON defensively: invalid entries dropped, garbage → empty", () => {
    const raw = JSON.stringify([
      { chain: "ethereum", address: A, note: "Ví lạnh", lastTxCount: 3 },
      { chain: "solana", address: A },
      { chain: "base", address: "0xbad" },
      { chain: "base", address: A, lastTxCount: -1 },
      { chain: "base", address: A, note: 5 },
      null,
    ]);
    expect(parseWatchlist(raw)).toEqual([{ chain: "ethereum", address: A, note: "Ví lạnh", lastTxCount: 3 }]);
    expect(parseWatchlist("not json")).toEqual([]);
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ a: 1 }))).toEqual([]);
  });

  test("addWallet normalises, dedupes per chain, trims notes and enforces the cap", () => {
    const one = addWallet([], { chain: "ethereum", address: A.toUpperCase().replace("0X", "0x"), note: "  ví chính  " });
    expect(one).toEqual({ ok: true, value: [{ chain: "ethereum", address: A, note: "ví chính" }] });
    if (!one.ok) throw new Error("unreachable");
    expect(addWallet(one.value, { chain: "ethereum", address: A })).toEqual({ ok: false, error: "DUPLICATE" });
    expect(addWallet(one.value, { chain: "base", address: A }).ok).toBe(true); // same address, other chain
    expect(addWallet([], { chain: "ethereum", address: "0x12" })).toEqual({ ok: false, error: "INVALID_ADDRESS" });
    expect(addWallet([], { chain: "tron", address: A })).toEqual({ ok: false, error: "UNSUPPORTED_CHAIN" });
    const full = Array.from({ length: MAX_WATCHED }, (_, i) => ({ chain: "ethereum" as const, address: `0x${i.toString(16).padStart(40, "0")}` }));
    expect(addWallet(full, { chain: "base", address: B })).toEqual({ ok: false, error: "FULL" });
  });

  test("notes are capped in length", () => {
    const r = addWallet([], { chain: "bsc", address: B, note: "x".repeat(200) });
    expect(r.ok && r.value[0]?.note?.length).toBe(40);
  });

  test("remove and markSeen are immutable; serialize round-trips", () => {
    const list = [
      { chain: "ethereum" as const, address: A },
      { chain: "base" as const, address: B },
    ];
    const removed = removeWallet(list, "ethereum", A);
    expect(removed).toEqual([{ chain: "base", address: B }]);
    expect(list).toHaveLength(2);
    const seen = markSeen(list, [{ chain: "base", address: B, txCount: 9 }]);
    expect(seen[1]).toEqual({ chain: "base", address: B, lastTxCount: 9 });
    expect(list[1]).toEqual({ chain: "base", address: B });
    expect(parseWatchlist(serializeWatchlist(seen))).toEqual(seen);
  });
});
