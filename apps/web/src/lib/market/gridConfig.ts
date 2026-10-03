import type { BoGridConfig } from "bo-grid/element";
import { type MarketGridRow, changeTone, formatCell, isLowConfidence } from "./gridRows";

/**
 * bo-grid configuration for the live market board. Colours come from our design tokens
 * (light DOM, so `var(--ds-*)` resolves); sharp corners per DESIGN.md.
 */
type Columns = NonNullable<BoGridConfig["columns"]>;

export const GRID_THEME = {
  bg: "var(--ds-color-surface-low)",
  headerBg: "var(--ds-color-surface)",
  rowA: "var(--ds-color-surface-low)",
  rowB: "var(--ds-color-surface-low)",
  rowHover: "var(--ds-color-surface-high)",
  text: "var(--ds-color-text)",
  textDim: "var(--ds-color-text-muted)",
  border: "var(--ds-color-outline-subtle)",
  up: "var(--ds-color-up)",
  down: "var(--ds-color-down)",
  amber: "var(--ds-color-accent)",
  selFill: "var(--ds-color-accent-tint)",
  selBorder: "var(--ds-color-accent)",
  mono: "var(--ds-font-mono)",
  sans: "var(--ds-font-prose)",
  scheme: "dark",
  radius: "0",
  fontSize: "13px",
} as const;

export const GRID_LABELS = {
  sortAscending: "Sắp xếp tăng dần",
  sortDescending: "Sắp xếp giảm dần",
  clearSort: "Bỏ sắp xếp",
  noRows: "Không có tài sản nào khớp.",
  loading: "Đang tải…",
  resizeColumn: (header: string) => `Đổi độ rộng cột ${header}`,
} as const;

const row = (r: unknown) => r as MarketGridRow;

/** Ticker + name as a real link (keyboard, middle-click, crawlers); text only, never innerHTML. */
function assetCell(r: MarketGridRow, navigate: (href: string) => void): HTMLElement {
  const href = `/tai-san/${r.symbol.toLowerCase()}`;
  const a = document.createElement("a");
  a.href = href;
  a.className = "ds-grid-asset";
  const symbol = document.createElement("span");
  symbol.className = "ds-grid-symbol";
  symbol.textContent = r.symbol;
  const name = document.createElement("span");
  name.className = "ds-grid-name";
  name.textContent = r.name;
  a.append(symbol, name);
  a.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // The row handler would navigate too; one navigation is enough.
    event.preventDefault();
    event.stopPropagation();
    navigate(href);
  });
  return a;
}

/**
 * Column widths are computed from the pane width (no `flex`: bo-grid's header keeps a 32px right
 * gutter that its flex sizing doesn't subtract, so flex columns overflowed by ~40px). Secondary
 * columns drop as the pane narrows; below that, a compact layout keeps asset, VND price and 24h.
 */
/** Measured: the header’s 32px right gutter + the rows’ 12px vertical scrollbar. */
const RESERVE_PX = 44;
const WIDTHS = { rank: 48, symbol: 124, priceUsd: 112, change24hBps: 92, volumeVnd: 136, sourcesLabel: 60 } as const;
const PRICE_MIN_PX = 128;
/** Dropped first → last as the pane narrows. */
export const DROP_ORDER = ["sourcesLabel", "rank", "priceUsd", "volumeVnd"] as const;
const COMPACT = { symbol: 66, change24hBps: 80, priceMin: 112 } as const;

export interface GridLayout {
  readonly keys: ReadonlySet<string>;
  readonly widths: Readonly<Record<string, number>>;
  readonly compact: boolean;
}

export function layoutFor(paneWidth: number): GridLayout {
  const usable = Math.max(0, paneWidth - RESERVE_PX);
  const keys = new Set<string>(["rank", "symbol", "priceVnd", "priceUsd", "change24hBps", "volumeVnd", "sourcesLabel"]);
  const fixed = () => [...keys].reduce((sum, k) => sum + (k === "priceVnd" ? 0 : WIDTHS[k as keyof typeof WIDTHS]), 0);
  for (const key of DROP_ORDER) {
    if (usable - fixed() >= PRICE_MIN_PX) break;
    keys.delete(key);
  }
  if (usable - fixed() >= PRICE_MIN_PX) {
    const widths = Object.fromEntries([...keys].map((k) => [k, k === "priceVnd" ? usable - fixed() : WIDTHS[k as keyof typeof WIDTHS]]));
    return { keys, widths, compact: false };
  }
  // Compact: the pane is too narrow even for asset + price + 24h at normal widths.
  const price = Math.max(COMPACT.priceMin, usable - COMPACT.symbol - COMPACT.change24hBps);
  return { keys, widths: { symbol: COMPACT.symbol, priceVnd: price, change24hBps: COMPACT.change24hBps }, compact: true };
}

/** Columns for a pane width (0 before the pane is measured: full desktop set). */
export function marketColumns(navigate: (href: string) => void, paneWidth = 0): { columns: Columns; compact: boolean } {
  const layout = layoutFor(paneWidth > 0 ? paneWidth : 1_200);
  const columns = allColumns(navigate)
    .filter((c) => layout.keys.has(c.key))
    .map((c) => ({ ...c, width: layout.widths[c.key] ?? c.width }));
  return { columns: columns as Columns, compact: layout.compact };
}

/**
 * Columns. The 24h column is deliberately not sortable: ranking by gains reads as promotion
 * (LEGAL_REGISTER R4). Direction always carries ▲/▼, never colour alone — so price flashes are the
 * neutral "changed" kind, without an up/down tint. Widths are set by `layoutFor`.
 */
function allColumns(navigate: (href: string) => void): Columns {
  return [
    { type: "number", key: "rank", header: "#", width: WIDTHS.rank, align: "right", pinned: "left", format: (v) => String(v), headerTooltip: "Thứ hạng theo khối lượng 24h (tổng các nguồn)" },
    { type: "text", key: "symbol", header: "Tài sản", width: WIDTHS.symbol, pinned: "left", render: (ctx) => assetCell(row(ctx.row), navigate) },
    { type: "number", key: "priceVnd", header: "Giá VNĐ", width: PRICE_MIN_PX, align: "right", format: formatCell.vnd, flash: "change", flashColor: false, cellClass: "ds-grid-price" },
    { type: "number", key: "priceUsd", header: "Giá USD", width: WIDTHS.priceUsd, align: "right", format: formatCell.usd, flash: "change", flashColor: false },
    {
      type: "number",
      key: "change24hBps",
      header: "24h",
      width: WIDTHS.change24hBps,
      align: "right",
      sortable: false,
      format: formatCell.change,
      cellClass: (v) => {
        const tone = changeTone(v);
        return tone ? `ds-grid-${tone}` : undefined;
      },
      headerTooltip: "Trung vị biến động 24 giờ của các nguồn có số liệu 24 giờ cuộn",
    },
    { type: "number", key: "volumeVnd", header: "KL 24h*", width: WIDTHS.volumeVnd, align: "right", format: formatCell.volume, headerTooltip: "Chỉ cộng khối lượng trên các nguồn tổng hợp, không phải toàn thị trường" },
    {
      type: "text",
      key: "sourcesLabel",
      header: "Nguồn",
      width: WIDTHS.sourcesLabel,
      align: "right",
      sortable: false,
      value: (r) => formatCell.sources(row(r)),
      cellClass: (_v, r) => (isLowConfidence(row(r)) ? "ds-grid-warn" : "ds-grid-dim"),
      tooltip: (_v, r) => `${row(r).sources} · độ lệch lớn nhất ${(row(r).maxDeviationBps / 100).toFixed(2).replace(".", ",")}%`,
    },
  ];
}
