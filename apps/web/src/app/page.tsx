import {
  type MarketAsset,
  formatUsdNanos,
  formatVnd,
  formatVndCompact,
  formatVndFromUsd,
  sparklinePath,
  topByAbsChange,
  topByVolume,
  totalVolume,
  usdNanosToVnd,
} from "@app/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/Hero";
import { Highlights } from "@/components/landing/Highlights";
import { LegalTimeline } from "@/components/landing/LegalTimeline";
import { type BoardRow, PriceBoard } from "@/components/landing/PriceBoard";
import { type Stat, StatsStrip } from "@/components/landing/StatsStrip";
import { ToolsBento } from "@/components/landing/ToolsBento";
import { Change } from "@/components/market/Change";
import { LivePricesProvider } from "@/components/market/LivePrices";
import { BRAND } from "@/lib/brand";
import { listInstruments } from "@/lib/legal";
import { assetNames, marketOverview, sparklineSeries } from "@/lib/market/instance";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name}: giá crypto bằng VNĐ, kiểm tra rủi ro ví, pháp lý tài sản mã hóa Việt Nam` },
};

const BOARD_ROWS = 6;
const vnTime = (d: Date) => d.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });

interface RowContext {
  readonly series: Readonly<Record<string, readonly number[]>>;
  readonly names: ReadonlyMap<string, string>;
  readonly rateVnd: bigint | null;
}

function toRow(a: MarketAsset, { series, names, rateVnd }: RowContext): BoardRow {
  const points = series[a.symbol];
  return {
    symbol: a.symbol,
    name: names.get(a.symbol) ?? a.symbol,
    priceVnd: rateVnd === null ? formatUsdNanos(a.priceUsdNanos) : formatVndFromUsd(a.priceUsdNanos, rateVnd),
    change24hBps: a.change24hBps,
    spark: points ? sparklinePath(points, 96, 28) : null,
  };
}

async function BoardSection() {
  const [overview, names] = await Promise.all([marketOverview(), assetNames()]);
  const byVolume = topByVolume(overview.assets, BOARD_ROWS);
  const byMove = topByAbsChange(overview.assets, BOARD_ROWS);
  const symbols = [...new Set([...byVolume, ...byMove].map((a) => a.symbol))];
  const series = await sparklineSeries(symbols);
  const updated = overview.sources.flatMap((s) => (s.fetchedAt ? [s.fetchedAt] : []))[0];
  const context: RowContext = { series, names, rateVnd: overview.fx.status === "ok" ? overview.fx.rateVnd : null };

  return (
    <PriceBoard
      updatedAt={updated ? vnTime(updated) : "—"}
      vndPerUsd={overview.fx.status === "ok" ? Number(overview.fx.rateVnd) : null}
      tabs={[
        { id: "volume", label: "Khối lượng lớn", rows: byVolume.map((a) => toRow(a, context)) },
        { id: "move", label: "Biến động mạnh (±)", rows: byMove.map((a) => toRow(a, context)) },
      ]}
    />
  );
}

async function MarketSections() {
  const overview = await marketOverview();
  const { assets, fx, sources } = overview;
  const btc = assets.find((a) => a.symbol === "BTC");
  const eth = assets.find((a) => a.symbol === "ETH");
  const volumeUsd = totalVolume(assets);
  const okSources = sources.filter((s) => s.status === "ok").length;
  const toVnd = (usdNanos: bigint) => (fx.status === "ok" ? formatVndCompact(usdNanosToVnd(usdNanos, fx.rateVnd)) : formatUsdNanos(usdNanos));

  const priceStat = (label: string, a: MarketAsset | undefined): Stat => ({
    label,
    value: (
      <span className="flex items-baseline gap-2">
        {a?.priceVnd != null ? formatVndCompact(a.priceVnd) : "—"}
        <span className="text-[12px] font-normal">
          <Change bps={a?.change24hBps ?? null} />
        </span>
      </span>
    ),
  });

  const stats: Stat[] = [
    { label: "Tỷ giá USD/VNĐ", value: fx.status === "ok" ? formatVnd(fx.rateVnd) : "—", note: fx.status === "ok" ? "Vietcombank · chuyển khoản" : "không phản hồi" },
    priceStat("Bitcoin", btc),
    priceStat("Ethereum", eth),
    { label: "KL 24h tổng hợp", value: toVnd(volumeUsd), note: `${assets.length} tài sản theo dõi` },
    { label: "Nguồn dữ liệu", value: `${okSources}/${sources.length}`, note: okSources === sources.length ? "Tất cả phản hồi" : "Một số nguồn gián đoạn" },
  ];

  const deviation = [...assets].sort((a, b) => b.maxDeviationBps - a.maxDeviationBps).slice(0, 3);

  return (
    <>
      <StatsStrip stats={stats} />
      <Highlights
        cards={[
          {
            title: "Khối lượng 24h lớn nhất",
            caption: "Cộng trên các nguồn tổng hợp",
            rows: topByVolume(assets, 3).map((a) => ({ symbol: a.symbol, primary: toVnd(a.volume24hUsdNanos) })),
          },
          {
            title: "Biến động 24h mạnh nhất",
            caption: "Tính cả tăng và giảm, xếp theo độ lớn",
            rows: topByAbsChange(assets, 3).map((a) => ({ symbol: a.symbol, primary: <Change bps={a.change24hBps} /> })),
          },
          {
            title: "Độ lệch giữa các nguồn",
            caption: "Chênh lệch lớn nhất so với giá trung vị",
            rows: deviation.map((a) => ({
              symbol: a.symbol,
              primary: <span className="text-text">{(a.maxDeviationBps / 100).toFixed(2).replace(".", ",")}%</span>,
              secondary: `${a.sources.length}/${sources.length} nguồn`,
            })),
          },
        ]}
      />
    </>
  );
}

async function LegalSection() {
  return <LegalTimeline instruments={await listInstruments()} now={new Date()} />;
}

function BlockSkeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export default function LandingPage() {
  return (
    <LivePricesProvider>
    <div className="flex flex-col gap-10">
      <Hero
        board={
          <Suspense fallback={<BlockSkeleton className="h-[420px]" />}>
            <BoardSection />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <BlockSkeleton className="h-20" />
            <BlockSkeleton className="h-48" />
          </div>
        }
      >
        <MarketSections />
      </Suspense>
      <ToolsBento />
      <Suspense fallback={<BlockSkeleton className="h-48" />}>
        <LegalSection />
      </Suspense>
      <Faq />
      <p className="border-t border-outline-subtle pt-4 text-[12px] leading-5 text-text-muted">
        Giá tham khảo, không phải báo giá giao dịch và không phải lời khuyên đầu tư. Tên sàn chỉ dùng để ghi nguồn dữ liệu.
      </p>
    </div>
    </LivePricesProvider>
  );
}
