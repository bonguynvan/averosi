import Link from "next/link";
import { MARKET_SORTS, type MarketPage, type MarketQuery, marketHref } from "@/lib/market/table";

/** Search + sort. A plain GET form: works without JavaScript and keeps state in the URL. */
export function MarketFilters({ query, total }: { query: MarketQuery; total: number }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <form action="/thi-truong" method="get" role="search" className="flex min-w-0 flex-1 items-stretch" data-testid="market-search">
        <label htmlFor="market-q" className="sr-only">
          Tìm theo mã hoặc tên tài sản
        </label>
        <input
          id="market-q"
          name="q"
          type="search"
          defaultValue={query.q}
          maxLength={40}
          placeholder="Tìm mã hoặc tên (BTC, Solana…)"
          autoComplete="off"
          className="min-w-0 flex-1 border border-outline-subtle bg-surface-lowest px-3 py-1.5 font-mono text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        {query.sort !== "khoi-luong" && <input type="hidden" name="sap-xep" value={query.sort} />}
        <button
          type="submit"
          className="border border-l-0 border-outline-subtle px-3 font-mono text-[12px] text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:text-accent focus-visible:text-accent"
        >
          Tìm
        </button>
      </form>
      <nav aria-label="Sắp xếp" className="flex flex-wrap items-center gap-1 font-mono text-[12px]">
        <span className="label-caps mr-1 text-text-muted">Sắp xếp</span>
        {MARKET_SORTS.map((s) => (
          <Link
            key={s.id}
            href={marketHref(query, { sort: s.id, page: 1 })}
            aria-current={s.id === query.sort ? "true" : undefined}
            className="border border-outline-subtle px-2 py-1 text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:text-accent aria-[current]:border-accent aria-[current]:text-accent"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <p className="w-full font-mono text-[11px] text-text-muted" role="status">
        {query.q ? `${total} kết quả cho “${query.q}”` : `${total} tài sản`} · niêm yết cặp USD pháp định trên ≥ 2 nguồn
      </p>
    </div>
  );
}

export function MarketPagination({ query, page }: { query: MarketQuery; page: MarketPage }) {
  if (page.pages <= 1) return null;
  const link = (target: number, label: string, rel?: "prev" | "next") => (
    <Link
      href={marketHref(query, { page: target })}
      rel={rel}
      className="border border-outline-subtle px-3 py-1 text-text-muted transition-colors duration-[var(--ds-duration-fast)] hover:text-accent"
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Phân trang" className="mt-3 flex items-center justify-between gap-2 font-mono text-[12px]" data-testid="market-pagination">
      {page.page > 1 ? link(page.page - 1, "← Trước", "prev") : <span />}
      <span className="text-text-muted">
        Trang {page.page}/{page.pages}
      </span>
      {page.page < page.pages ? link(page.page + 1, "Sau →", "next") : <span />}
    </nav>
  );
}
