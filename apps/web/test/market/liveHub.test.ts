import { describe, expect, test, vi } from "vitest";
import { createLiveHub } from "@/lib/market/liveHub";

const price = (symbol: string) => ({ symbol, priceUsd: 1, sources: 1, at: 0 });

describe("createLiveHub", () => {
  test("one upstream subscription shared by all listeners; started lazily, stopped at zero", async () => {
    let emit: ((p: ReturnType<typeof price>[]) => void) | null = null;
    const stop = vi.fn(async () => undefined);
    const upstream = vi.fn(async (e: (p: ReturnType<typeof price>[]) => void) => {
      emit = e;
      return stop;
    });
    const hub = createLiveHub(upstream);
    expect(upstream).not.toHaveBeenCalled();

    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = await hub.subscribe((p) => a.push(p));
    const offB = await hub.subscribe((p) => b.push(p));
    expect(upstream).toHaveBeenCalledTimes(1);

    emit!([price("BTC")]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    await offA();
    emit!([price("ETH")]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);
    expect(hub.size()).toBe(1);

    await offB();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(hub.size()).toBe(0);

    await hub.subscribe(() => undefined);
    expect(upstream).toHaveBeenCalledTimes(2); // restarts on demand
  });

  test("a throwing listener does not break the others", async () => {
    let emit: ((p: ReturnType<typeof price>[]) => void) | null = null;
    const hub = createLiveHub(async (e) => {
      emit = e;
      return async () => undefined;
    });
    const ok: unknown[] = [];
    await hub.subscribe(() => {
      throw new Error("bad listener");
    });
    await hub.subscribe((p) => ok.push(p));
    emit!([price("BTC")]);
    expect(ok).toHaveLength(1);
  });
});
