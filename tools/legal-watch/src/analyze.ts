import { z } from "zod";
import type { KnownState } from "./state";

const httpsUrl = z.url().startsWith("https://");
const isoOrNull = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const ChangeSchema = z.object({
  type: z.enum(["new", "amended", "repealed", "guidance", "draft"]),
  number: z.string().nullable(),
  title: z.string().min(1),
  issuer: z.string().nullable(),
  issuedAt: isoOrNull,
  effectiveAt: isoOrNull,
  summary: z.string(),
  impact: z.string(),
  sourceUrls: z.array(httpsUrl).min(1),
});

const FindingsSchema = z.object({
  changes: z.array(ChangeSchema),
  licensing: z.object({ anyLicensed: z.boolean(), summary: z.string(), sourceUrls: z.array(httpsUrl) }),
});

export type Change = z.infer<typeof ChangeSchema>;
export type Findings = z.infer<typeof FindingsSchema>;

export interface Citation {
  readonly url: string;
  readonly title: string;
  readonly date: string | null;
}

const AgentResponseSchema = z.object({
  output: z.array(z.object({ type: z.string(), results: z.array(z.object({ url: z.string(), title: z.string().optional(), date: z.string().nullish() })).optional() }).loose()),
  output_text: z.string(),
});

function stripFence(text: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (m?.[1] ?? text).trim();
}

/** Validates the model's JSON strictly; a malformed answer must fail the run rather than open a misleading issue. */
export function parseAgentResponse(raw: unknown): { findings: Findings; citations: Citation[] } {
  const res = AgentResponseSchema.parse(raw);
  const findings = FindingsSchema.parse(JSON.parse(stripFence(res.output_text)));
  const citations = res.output
    .flatMap((o) => (o.type === "search_results" ? (o.results ?? []) : []))
    .map((r) => ({ url: r.url, title: r.title ?? r.url, date: r.date ?? null }));
  return { findings, citations };
}

export interface Analysis {
  readonly newChanges: readonly Change[];
  readonly licensingChanged: boolean;
  readonly reviewDueInDays: number;
  readonly needsAttention: boolean;
}

const REVIEW_WARNING_DAYS = 7;
const DAY_MS = 86_400_000;
const normalizeNumber = (n: string) => n.replace(/\s+/g, "").toLowerCase();

/** Keeps only what the public tracker does not already reflect. */
export function analyze(state: KnownState, findings: Findings, today: string): Analysis {
  const known = new Set(state.instruments.map((i) => normalizeNumber(i.number)));
  const newChanges = findings.changes.filter((c) => c.type !== "new" || c.number === null || !known.has(normalizeNumber(c.number)));
  const licensingChanged = findings.licensing.anyLicensed !== state.licensing.anyLicensed;
  const reviewDueInDays = Math.round((Date.parse(state.nextReviewDue) - Date.parse(today)) / DAY_MS);
  return {
    newChanges,
    licensingChanged,
    reviewDueInDays,
    needsAttention: newChanges.length > 0 || licensingChanged || reviewDueInDays <= REVIEW_WARNING_DAYS,
  };
}
