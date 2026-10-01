import { type Result, err, ok } from "@app/core";

/**
 * Same-origin JSON-RPC fallback for the browser wallet transport: only what is needed to follow a
 * transaction the visitor already sent from their own wallet. Never signing, sending, eth_call or logs.
 */
export const RPC_PROXY_METHODS: ReadonlySet<string> = new Set(["eth_chainId", "eth_blockNumber", "eth_getTransactionReceipt", "eth_getTransactionByHash"]);

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export interface ProxyCall {
  readonly id: number | string;
  readonly method: string;
  readonly params: readonly string[];
}

export type ProxyError = "INVALID_REQUEST" | "METHOD_NOT_ALLOWED" | "INVALID_PARAMS";

export function parseProxyCall(body: unknown): Result<ProxyCall, ProxyError> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return err("INVALID_REQUEST");
  const b = body as { id?: unknown; method?: unknown; params?: unknown };
  if (typeof b.method !== "string" || (typeof b.id !== "number" && typeof b.id !== "string")) return err("INVALID_REQUEST");
  if (!RPC_PROXY_METHODS.has(b.method)) return err("METHOD_NOT_ALLOWED");
  const params = b.params === undefined ? [] : b.params;
  if (!Array.isArray(params)) return err("INVALID_PARAMS");
  const needsHash = b.method === "eth_getTransactionReceipt" || b.method === "eth_getTransactionByHash";
  if (needsHash && !(params.length === 1 && typeof params[0] === "string" && TX_HASH.test(params[0]))) return err("INVALID_PARAMS");
  if (!needsHash && params.length > 0) return err("INVALID_PARAMS");
  return ok({ id: b.id, method: b.method, params: params as string[] });
}
