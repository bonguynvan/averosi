import { type MarketAsset, formatUsdNanos, formatVndCompact, formatVndFromUsd } from "@app/core";
import Link from "next/link";
import { Change } from "./Change";
import { LiveVndPrice } from "./LivePrices";

const TOTAL_SOURCES = 4;
/** Sources disagreeing by more than this (3%) get a visible data-quality mark. */
const DEVIATION_WARN_BPS = 300;
const percent = (bps: number) => `${(bps / 100).toFixed(1).replace(".", ",")}%`;

interface MarketTableProps {
  readonly assets: readonly MarketAsset[];
  readonly names: ReadonlyMap<string, string>;
  readonly vndPerUsd: number | null;
  /** Rank of the first row (pagination). */
  readonly firstRank?: number;
}

export function MarketTable({ assets, names, vndPerUsd, firstRank = 1 }: MarketTableProps) {
  return (
    <table className="w-full font-mono text-[13px]" data-testid="market-table">
      <caption className="sr-only">Giá tham khảo các tài sản mã hóa, quy đổi VNĐ</caption>
      <thead>
        <tr className="label-caps text-left text-text-muted [&>th]:sticky [&>th]:top-[var(--ds-shell-top)] [&>th]:z-10 [&>th]:border-b [&>th]:border-outline-subtle [&>th]:bg-surface-low">
          <th scope="col" className="hidden py-2 pr-2 text-right font-bold sm:table-cell">#</th>
          <th scope="col" className="py-2 pr-3 font-bold">Tài sản</th>
          <th scope="col" className="py-2 pr-3 text-right font-bold">Giá VNĐ</th>
          <th scope="col" className="hidden py-2 pr-3 text-right font-bold md:table-cell">Giá USD</th>
          <th scope="col" className="py-2 pr-3 text-right font-bold">24h</th>
          <th scope="col" className="hidden py-2 pr-3 text-right font-bold lg:table-cell">KL 24h*</th>
          <th scope="col" className="hidden py-2 text-right font-bold sm:table-cell">Nguồn</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((a, i) => (
          <tr key={a.symbol} className="border-b border-outline-subtle transition-colors duration-[var(--ds-duration-fast)] hover:bg-surface">
            <td className="hidden py-2 pr-2 text-right text-[11px] text-text-muted sm:table-cell">{firstRank + i}</td>
            <th scope="row" className="py-2 pr-3 text-left font-normal">
              <Link href={`/tai-san/${a.symbol.toLowerCase()}`} className="group flex flex-col">
                <span className="font-semibold text-text group-hover:text-accent">{a.symbol}</span>
                <span className="max-w-[12rem] truncate text-[11px] text-text-muted">{names.get(a.symbol) ?? a.symbol}</span>
              </Link>
            </th>
            <td className="py-2 pr-3 text-right text-accent-soft">
              {a.priceVnd === null || vndPerUsd === null ? "—" : <LiveVndPrice symbol={a.symbol} initial={formatVndFromUsd(a.priceUsdNanos, BigInt(vndPerUsd))} vndPerUsd={vndPerUsd} />}
            </td>
            <td className="hidden py-2 pr-3 text-right text-text-muted md:table-cell">{formatUsdNanos(a.priceUsdNanos)}</td>
            <td className="py-2 pr-3 text-right">
              <Change bps={a.change24hBps} />
            </td>
            <td className="hidden py-2 pr-3 text-right text-text-muted lg:table-cell">
              {a.volume24hVnd === null ? "—" : formatVndCompact(a.volume24hVnd)}
            </td>
            <td
              className="hidden py-2 text-right sm:table-cell"
              title={`${a.sources.join(", ")} · độ lệch lớn nhất giữa các nguồn ${percent(a.maxDeviationBps)}`}
            >
              <span className={a.sources.length >= 2 && a.maxDeviationBps <= DEVIATION_WARN_BPS ? "text-text-muted" : "text-warning"}>
                {a.maxDeviationBps > DEVIATION_WARN_BPS && <span aria-label={`nguồn lệch ${percent(a.maxDeviationBps)}`}>≠ </span>}
                {a.sources.length}/{TOTAL_SOURCES}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
