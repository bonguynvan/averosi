import { parseChainKey } from "@app/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientKeyFromHeaders } from "@/lib/risk/form";
import { rpcProxyLimiter, rpcRequest } from "@/lib/risk/instance";
import { parseProxyCall } from "@/lib/web3/rpcProxy";

type Params = { params: Promise<{ chain: string }> };

/** Read-only, allow-listed JSON-RPC fallback so the browser never contacts third-party RPC providers. */
export async function POST(request: Request, { params }: Params) {
  const chain = parseChainKey((await params).chain);
  if (!chain.ok) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32602, message: "unsupported chain" } }, { status: 400 });
  if (!rpcProxyLimiter.take(clientKeyFromHeaders(await headers()))) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32005, message: "rate limited" } }, { status: 429 });
  }
  const call = parseProxyCall(await request.json().catch(() => null));
  if (!call.ok) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32601, message: call.error } }, { status: 400 });
  try {
    const result = await rpcRequest(chain.value, call.value.method, call.value.params);
    return NextResponse.json({ jsonrpc: "2.0", id: call.value.id, result });
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: call.value.id, error: { code: -32603, message: "upstream error" } }, { status: 502 });
  }
}
