import { parseTimeframe } from "@app/core";
import { type NextRequest, NextResponse } from "next/server";
import { candleRateLimiter, findMarketAsset, indicators } from "@/lib/market/instance";
import { clientKeyFromHeaders } from "@/lib/risk/form";

type Params = { params: Promise<{ symbol: string }> };

/** Latest technical-indicator values for one asset/timeframe. Descriptive values only — no signals (R4). */
export async function GET(request: NextRequest, { params }: Params) {
  const asset = await findMarketAsset((await params).symbol).catch(() => undefined);
  const timeframe = parseTimeframe(request.nextUrl.searchParams.get("tf") ?? "1h");
  if (!asset || !timeframe) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  if (!candleRateLimiter.take(clientKeyFromHeaders(request.headers))) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  try {
    const result = await indicators(asset.symbol, timeframe);
    if (!result) return NextResponse.json({ error: "NOT_READY" }, { status: 404 });
    return NextResponse.json(
      { ...result, note: "Giá trị chỉ báo kỹ thuật (USD), chỉ để tham khảo. Không phải tín hiệu hay khuyến nghị." },
      { headers: { "cache-control": "public, max-age=30" } },
    );
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
