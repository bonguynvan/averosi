import { NextResponse } from "next/server";
import { marketOverview } from "@/lib/market/instance";

const MICROS = 1_000_000;

/** Compact reference quotes (USD) for client widgets such as the chart watchlist. Same data as /thi-truong. */
export async function GET() {
  try {
    const overview = await marketOverview();
    const quotes = overview.assets.map((a) => ({
      symbol: a.symbol,
      priceUsd: Number(a.priceUsdMicros) / MICROS,
      change24hBps: a.change24hBps,
    }));
    const vndPerUsd = overview.fx.status === "ok" ? Number(overview.fx.rateVnd) : null;
    return NextResponse.json({ quotes, vndPerUsd }, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
