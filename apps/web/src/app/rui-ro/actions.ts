"use server";

import { headers } from "next/headers";
import { type RiskFormError, clientKeyFromHeaders, parseRiskForm } from "@/lib/risk/form";
import { riskRateLimiter, riskService } from "@/lib/risk/instance";
import type { SerializedRiskReport } from "@/lib/risk/service";
import { serializeReport } from "@/lib/risk/service";

export type RiskActionState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly error: RiskFormError | "RATE_LIMITED" | "UNAVAILABLE" }
  | { readonly status: "done"; readonly report: SerializedRiskReport };

/** POST-only so the queried address never lands in URLs, history or access logs. */
export async function checkRiskAction(_prev: RiskActionState, form: FormData): Promise<RiskActionState> {
  const parsed = parseRiskForm(form);
  if (!parsed.ok) return { status: "error", error: parsed.error };

  if (!riskRateLimiter.take(clientKeyFromHeaders(await headers()))) {
    return { status: "error", error: "RATE_LIMITED" };
  }

  try {
    return { status: "done", report: serializeReport(await riskService.check(parsed.value)) };
  } catch {
    return { status: "error", error: "UNAVAILABLE" };
  }
}
