import { type FxSource, sourced } from "@app/core";
import { createTtlCache } from "./ttlCache";

const VCB_URL = "https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx";
const SOURCE = "Vietcombank (USD chuyển khoản)";
// Sanity band: anything outside is a parsing or upstream error, not a real rate.
const MIN_PLAUSIBLE = 10_000n;
const MAX_PLAUSIBLE = 100_000n;

/** Extracts the USD "Transfer" rate from Vietcombank's public XML feed, in whole dong. */
export function parseVietcombankUsdTransfer(xml: string): bigint {
  const match = /<Exrate\s+CurrencyCode="USD"[^>]*\sTransfer="([\d,]+)(?:\.\d+)?"/.exec(xml);
  if (!match?.[1]) throw new Error("Vietcombank: USD rate not found");
  const rate = BigInt(match[1].replaceAll(",", ""));
  if (rate < MIN_PLAUSIBLE || rate > MAX_PLAUSIBLE) throw new Error(`Vietcombank: implausible USD rate ${rate}`);
  return rate;
}

export interface VietcombankFxOptions {
  readonly fetchFn?: typeof fetch;
  readonly now?: () => Date;
  /** Feed asks for at most one request every 5 minutes. */
  readonly ttlMs: number;
}

/**
 * USD/VND from a state-owned commercial bank's public feed. The SBV central-rate site blocks automated
 * access, so this is the official-bank fallback; the source is always labelled in the UI.
 */
export function createVietcombankFx({ fetchFn = fetch, now = () => new Date(), ttlMs }: VietcombankFxOptions): FxSource {
  const cache = createTtlCache({ ttlMs, now: () => now().getTime() });
  return {
    usdVndRate: () =>
      cache.get("usd", async () => {
        const res = await fetchFn(VCB_URL, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok) throw new Error(`Vietcombank: HTTP ${res.status}`);
        return sourced(parseVietcombankUsdTransfer(await res.text()), SOURCE, now());
      }),
  };
}
