import { parseChainKey, parseEvmAddress } from "@app/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serializeApprovalReport } from "@/lib/approvals/service";
import { clientKeyFromHeaders } from "@/lib/risk/form";
import { approvalRateLimiter, approvalService } from "@/lib/risk/instance";

const Body = z.object({ chain: z.string(), address: z.string(), fresh: z.boolean().optional() });

/** POST keeps the address out of URLs/logs. Read-only: returns approvals; revoking happens in the visitor's wallet. */
export async function POST(request: Request) {
  if (!approvalRateLimiter.take(clientKeyFromHeaders(await headers()))) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const chain = parseChainKey(body.data.chain);
  const address = parseEvmAddress(body.data.address);
  if (!chain.ok || !address.ok) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const report = await approvalService.check({ chain: chain.value, owner: address.value, ...(body.data.fresh ? { fresh: true } : {}) });
    return NextResponse.json(serializeApprovalReport(report), { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503 });
  }
}
