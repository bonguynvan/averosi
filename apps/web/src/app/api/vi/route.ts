import { parseChainKey, parseEvmAddress } from "@app/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKeyFromHeaders } from "@/lib/risk/form";
import { walletRateLimiter, walletService } from "@/lib/risk/instance";
import { serializeWalletView } from "@/lib/wallet/portfolio";
import { MAX_WATCHED } from "@/lib/wallet/watchlist";

const Body = z.object({ wallets: z.array(z.object({ chain: z.string(), address: z.string() })).min(1).max(MAX_WATCHED) });

/**
 * POST so addresses stay out of URLs and access logs. Nothing is stored server-side beyond a
 * 30s per-address cache; notes never leave the browser.
 */
export async function POST(request: Request) {
  if (!walletRateLimiter.take(clientKeyFromHeaders(await headers()))) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  const queries = parsed.data.wallets.flatMap((w) => {
    const chain = parseChainKey(w.chain);
    const address = parseEvmAddress(w.address);
    return chain.ok && address.ok ? [{ chain: chain.value, address: address.value }] : [];
  });
  if (queries.length !== parsed.data.wallets.length) return NextResponse.json({ error: "INVALID_WALLET" }, { status: 400 });

  const views = await Promise.all(queries.map((q) => walletService.read(q)));
  return NextResponse.json({ wallets: views.map(serializeWalletView) }, { headers: { "cache-control": "no-store" } });
}
