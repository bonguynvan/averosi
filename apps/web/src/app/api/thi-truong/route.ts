import { NextResponse } from "next/server";
import { assetNames, marketOverview } from "@/lib/market/instance";
import { toQuotesDto } from "@/lib/market/quotesDto";

/** Compact reference quotes (USD) for client widgets: chart watchlist, live market grid. Same data as /thi-truong. */
export async function GET() {
  try {
    const [overview, names] = await Promise.all([marketOverview(), assetNames()]);
    return NextResponse.json(toQuotesDto(overview, names), { headers: { "cache-control": "public, max-age=15" } });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
