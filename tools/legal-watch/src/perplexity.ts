import type { AgentRequest } from "./request";

const ENDPOINT = "https://api.perplexity.ai/v1/agent";
const TIMEOUT_MS = 180_000;

/** POST /v1/agent (Perplexity Agent API). Returns the raw JSON; validation happens in analyze.ts. */
export async function callAgent(apiKey: string, body: AgentRequest): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    // Response bodies can echo the request; keep the log short and never print the key.
    throw new Error(`Perplexity Agent API: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}
