import type { NextRequest } from "next/server";
import { MAX_LIVE_STREAMS_PER_CLIENT, subscribeLive } from "@/lib/market/instance";
import { createStreamLimiter } from "@/lib/market/streamLimiter";
import { clientKeyFromHeaders } from "@/lib/risk/form";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 20_000;
const UNKNOWN_CLIENT = "unknown";
/** Without proxy IP headers every client shares one key; give that bucket a global cap instead of a per-client one. */
const UNKNOWN_CLIENT_CAP = 500;
const perClient = createStreamLimiter(MAX_LIVE_STREAMS_PER_CLIENT);
const unknownClients = createStreamLimiter(UNKNOWN_CLIENT_CAP);

/**
 * Server-Sent Events: realtime reference prices (median of exchange tickers, aggregated by the worker).
 * Same-origin only — browsers never connect to exchanges.
 */
export async function GET(request: NextRequest) {
  const key = clientKeyFromHeaders(request.headers);
  const release = key === UNKNOWN_CLIENT ? unknownClients.acquire(key) : perClient.acquire(key);
  if (!release) return new Response("Too many live streams", { status: 429 });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream already closed
        }
      };
      send("retry: 5000\n\n");
      const unsubscribe = await subscribeLive((prices) => send(`event: prices\ndata: ${JSON.stringify(prices)}\n\n`));
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        void unsubscribe();
        release();
      };
      request.signal.addEventListener("abort", () => {
        cleanup?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
