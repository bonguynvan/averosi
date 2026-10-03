import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketBoard } from "@/components/market/MarketBoard";
import { MarketFilters, MarketPagination } from "@/components/market/MarketControls";
import { LiveBadge, LivePricesProvider } from "@/components/market/LivePrices";
import { MarketNotice } from "@/components/market/MarketNotice";
import { MarketTable } from "@/components/market/MarketTable";
import { SourceStatusList } from "@/components/market/SourceStatusList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Panel } from "@/components/ui/Panel";
import { assetNames, marketOverview } from "@/lib/market/instance";
import { type MarketQuery, parseMarketQuery, selectMarketPage } from "@/lib/market/table";

export const metadata: Metadata = {
  title: "Thị trường: giá tham khảo tài sản mã hóa bằng VNĐ",
  description: "Giá tham khảo hàng trăm tài sản mã hóa quy đổi VNĐ, trung vị từ nhiều nguồn dữ liệu công khai. Không phải báo giá giao dịch.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function MarketContent({ query }: { query: MarketQuery }) {
  const [overview, names] = await Promise.all([marketOverview(), assetNames()]);
  const vndPerUsd = overview.fx.status === "ok" ? Number(overview.fx.rateVnd) : null;
  const page = selectMarketPage(overview.assets, names, query);

  return (
    <LivePricesProvider>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="font-mono text-[22px] leading-7 font-bold text-text">Thị trường</h1>
          <Panel title="Giá tham khảo · VNĐ" aside={<LiveBadge />}>
            {overview.assets.length === 0 ? (
              <p role="status" className="text-[13px] text-text-muted">
                Dữ liệu tạm thời không khả dụng. Không có số liệu nào được hiển thị thay thế.
              </p>
            ) : (
              <MarketBoard>
                <MarketFilters query={query} total={page.total} />
                {page.rows.length === 0 ? (
                  <p role="status" className="py-6 text-center text-[13px] text-text-muted">
                    Không có tài sản nào khớp. Thử mã khác, hoặc tài sản này chưa được niêm yết cặp USD trên ít nhất hai nguồn.
                  </p>
                ) : (
                  <MarketTable assets={page.rows} names={names} vndPerUsd={vndPerUsd} firstRank={page.offset} />
                )}
                <MarketPagination query={query} page={page} />
              </MarketBoard>
            )}
            <div className="mt-3 border-t border-outline-subtle pt-3">
              <SourceStatusList sources={overview.sources} fx={overview.fx} />
            </div>
          </Panel>
        </div>
        <aside className="flex flex-col gap-4" aria-label="Phương pháp và lưu ý">
          <MarketNotice />
        </aside>
      </div>
    </LivePricesProvider>
  );
}

export default async function MarketsPage({ searchParams }: Props) {
  const query = parseMarketQuery(await searchParams);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketContent query={query} />
    </Suspense>
  );
}
