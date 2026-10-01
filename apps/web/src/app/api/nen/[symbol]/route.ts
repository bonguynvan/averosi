import { findAsset } from "@app/core";
import { type NextRequest, NextResponse } from "next/server";
import { parseTimeframe } from "@/lib/market/candles";
import { candleRateLimiter, candles } from "@/lib/market/instance";
import { clientKeyFromHeaders } from "@/lib/risk/form";

type Params = { params: Promise<{ symbol: string }> };

/** Same-origin candle proxy: the visitor's browser never contacts an exchange (privacy + strict CSP). */
export async function GET(request: NextRequest, { params }: Params) {
  const asset = findAsset((await params).symbol);
  const timeframe = parseTimeframe(request.nextUrl.searchParams.get("tf") ?? "1h");
  if (!asset || !timeframe) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  if (!candleRateLimiter.take(clientKeyFromHeaders(request.headers))) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const result = await candles(asset.symbol, timeframe);
    return NextResponse.json(result, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
