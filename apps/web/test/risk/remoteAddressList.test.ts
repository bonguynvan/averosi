import { parseEvmAddress, type EvmAddress } from "@app/core";
import { describe, expect, test, vi } from "vitest";
import { createRemoteAddressList } from "@/lib/risk/remoteAddressList";

const addr = (s: string): EvmAddress => {
  const r = parseEvmAddress(s);
  if (!r.ok) throw new Error("bad fixture");
  return r.value;
};
const A = "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A";
const B = "0x1111111111111111111111111111111111111111";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("createRemoteAddressList", () => {
  test("matches case-insensitively against a JSON array of addresses", async () => {
    const fetchFn = vi.fn(async () => response([A]));
    const list = createRemoteAddressList({ name: "OFAC SDN", url: "https://x/list.json", ttlMs: 60_000, fetchFn, now: () => new Date(0) });

    expect(list.name).toBe("OFAC SDN");
    expect((await list.contains(addr(A))).data).toBe(true);
    expect((await list.contains(addr(B))).data).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test("ignores non-address entries", async () => {
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 1, fetchFn: async () => response([A, "bc1qxyz", 42]), now: () => new Date(0) });
    expect((await list.contains(addr(A))).data).toBe(true);
  });

  test("refetches after TTL and reports the time of the data actually used", async () => {
    let t = 0;
    const fetchFn = vi.fn(async () => response([A]));
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 1_000, fetchFn, now: () => new Date(t) });
    await list.contains(addr(A));
    t = 2_000;
    const result = await list.contains(addr(A));
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.fetchedAt).toEqual(new Date(2_000));
  });

  test("serves the last good copy (with its old timestamp) when a refresh fails", async () => {
    let t = 0;
    const fetchFn = vi.fn().mockResolvedValueOnce(response([A])).mockRejectedValueOnce(new Error("down"));
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 1_000, fetchFn, now: () => new Date(t) });
    await list.contains(addr(A));
    t = 5_000;
    const result = await list.contains(addr(A));
    expect(result).toMatchObject({ data: true, fetchedAt: new Date(0) });
  });

  test("throws when there is no copy at all and the fetch fails", async () => {
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 1, fetchFn: async () => response("x", 500), now: () => new Date(0) });
    await expect(list.contains(addr(A))).rejects.toThrow("L: HTTP 500");
  });

  test("rejects a payload that is not an array", async () => {
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 1, fetchFn: async () => response({ a: 1 }), now: () => new Date(0) });
    await expect(list.contains(addr(A))).rejects.toThrow();
  });

  test("concurrent lookups share one in-flight fetch", async () => {
    const fetchFn = vi.fn(async () => response([A]));
    const list = createRemoteAddressList({ name: "L", url: "u", ttlMs: 60_000, fetchFn, now: () => new Date(0) });
    await Promise.all([list.contains(addr(A)), list.contains(addr(B))]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
