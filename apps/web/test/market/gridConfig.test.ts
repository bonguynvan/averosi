import { describe, expect, test } from "vitest";
import { GRID_LABELS, GRID_THEME, layoutFor, marketColumns } from "@/lib/market/gridConfig";
import { toGridRows } from "@/lib/market/gridRows";

type Col = { key: string; sortable?: boolean; format?: (v: unknown) => string; value?: (r: unknown) => unknown; cellClass?: unknown; tooltip?: unknown; flash?: unknown; flashColor?: boolean };

const columns = marketColumns(() => undefined).columns as unknown as Col[];
const byKey = (key: string) => columns.find((c) => c.key === key) as Col;
const [row] = toGridRows([{ symbol: "BTC", name: "Bitcoin", priceUsd: 1, change24hBps: -10, volumeUsd: 1, sources: ["Coinbase", "Kraken", "Bitstamp"], maxDeviationBps: 450 }], 1);

describe("market grid columns", () => {
  test("24h change and sources are not sortable (R4); prices flash neutrally (no colour-only direction)", () => {
    expect(byKey("change24hBps").sortable).toBe(false);
    expect(byKey("sourcesLabel").sortable).toBe(false);
    for (const key of ["priceVnd", "priceUsd"]) expect(byKey(key)).toMatchObject({ flash: "change", flashColor: false });
    expect(columns.map((c) => c.key)).toEqual(["rank", "symbol", "priceVnd", "priceUsd", "change24hBps", "volumeVnd", "sourcesLabel"]);
  });

  test("cell helpers: rank as integer, direction class, low-confidence sources", () => {
    expect(byKey("rank").format?.(12)).toBe("12");
    const changeClass = byKey("change24hBps").cellClass as (v: unknown) => string | undefined;
    expect([changeClass(5), changeClass(-5), changeClass(0)]).toEqual(["ds-grid-up", "ds-grid-down", undefined]);
    const sources = byKey("sourcesLabel");
    expect(sources.value?.(row)).toBe("≠ 3/4");
    expect((sources.cellClass as (v: unknown, r: unknown) => string)(null, row)).toBe("ds-grid-warn");
    expect((sources.cellClass as (v: unknown, r: unknown) => string)(null, { ...row, maxDeviationBps: 1 })).toBe("ds-grid-dim");
    expect((sources.tooltip as (v: unknown, r: unknown) => string)(null, row)).toBe("Coinbase, Kraken, Bitstamp · độ lệch lớn nhất 4,50%");
  });

  test("theme uses design tokens with sharp corners; labels are Vietnamese", () => {
    expect(Object.values(GRID_THEME).filter((v) => typeof v === "string" && v.startsWith("#"))).toEqual([]);
    expect(GRID_THEME.radius).toBe("0");
    expect(GRID_LABELS.noRows).toBe("Không có tài sản nào khớp.");
    expect(GRID_LABELS.resizeColumn("Giá")).toBe("Đổi độ rộng cột Giá");
  });

  test("layout: widths fill the pane exactly; secondary columns drop as it narrows; compact last", () => {
    const sum = (w: Readonly<Record<string, number>>) => Object.values(w).reduce((a, b) => a + b, 0);
    const wide = layoutFor(746);
    expect([...wide.keys]).toEqual(["rank", "symbol", "priceVnd", "priceUsd", "change24hBps", "volumeVnd", "sourcesLabel"]);
    expect(sum(wide.widths)).toBe(746 - 44);
    expect(wide.compact).toBe(false);
    expect([...layoutFor(700).keys]).toEqual(["rank", "symbol", "priceVnd", "priceUsd", "change24hBps", "volumeVnd"]);
    expect([...layoutFor(600).keys]).toEqual(["symbol", "priceVnd", "change24hBps", "volumeVnd"]);
    expect([...layoutFor(420).keys]).toEqual(["symbol", "priceVnd", "change24hBps"]);
    const phone = layoutFor(317);
    expect(phone.compact).toBe(true);
    expect(phone.widths).toEqual({ symbol: 66, priceVnd: 127, change24hBps: 80 });
    expect(sum(phone.widths)).toBe(317 - 44);
    expect(layoutFor(262).widths.priceVnd).toBe(112); // floor: the grid scrolls horizontally, the page doesn't
  });

  test("columns follow the layout; unmeasured pane uses the desktop set", () => {
    const phone = marketColumns(() => undefined, 317);
    expect(phone.compact).toBe(true);
    expect((phone.columns as unknown as { key: string; width: number }[]).map((c) => [c.key, c.width])).toEqual([
      ["symbol", 66],
      ["priceVnd", 127],
      ["change24hBps", 80],
    ]);
    expect(marketColumns(() => undefined).columns).toHaveLength(7);
  });
});
