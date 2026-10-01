import { type ChainKey, type EvmAddress, type Result, err, ok, parseChainKey, parseEvmAddress } from "@app/core";

export type RiskFormError = "UNSUPPORTED_CHAIN" | "INVALID_ADDRESS";

export function parseRiskForm(form: FormData): Result<{ chain: ChainKey; address: EvmAddress }, RiskFormError> {
  const chain = parseChainKey(String(form.get("chain") ?? ""));
  if (!chain.ok) return err(chain.error);
  const address = parseEvmAddress(String(form.get("address") ?? ""));
  if (!address.ok) return err(address.error);
  return ok({ chain: chain.value, address: address.value });
}

/** Rate-limit key only; never logged or stored beyond the limiter window. */
export function clientKeyFromHeaders(headers: Headers): string {
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
