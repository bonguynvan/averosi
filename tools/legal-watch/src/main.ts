import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { analyze, parseAgentResponse } from "./analyze";
import { upsertIssue } from "./github";
import { callAgent } from "./perplexity";
import { buildIssue } from "./report";
import { buildAgentRequest } from "./request";
import { readKnownState } from "./state";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const Env = z.object({
  PERPLEXITY_API_KEY: z.string().min(1, "PERPLEXITY_API_KEY is not set (GitHub → Settings → Secrets → Actions)"),
  PERPLEXITY_PRESET: z.enum(["fast", "low", "medium", "high"]).default("low"),
  DRY_RUN: z.enum(["0", "1"]).default("0"),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPOSITORY: z.string().optional(),
  GITHUB_STEP_SUMMARY: z.string().optional(),
});

const log = (line: string) => process.stdout.write(`${line}\n`);

async function summary(file: string | undefined, markdown: string): Promise<void> {
  if (file) await appendFile(file, `${markdown}\n`);
}

async function main(): Promise<void> {
  const env = Env.parse({ ...process.env, PERPLEXITY_PRESET: process.env.PERPLEXITY_PRESET || undefined, DRY_RUN: process.env.DRY_RUN || undefined });
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10); // Vietnam calendar date
  const state = await readKnownState(REPO_ROOT);

  log(`Scanning ${state.reviewedAt} → ${today} (${state.instruments.length} known instruments, preset ${env.PERPLEXITY_PRESET})`);
  const { findings, citations } = parseAgentResponse(await callAgent(env.PERPLEXITY_API_KEY, buildAgentRequest(state, today, env.PERPLEXITY_PRESET)));
  const analysis = analyze(state, findings, today);
  const issue = buildIssue({ state, today, analysis, licensingSummary: findings.licensing.summary, citations, preset: env.PERPLEXITY_PRESET });

  log(`Changes: ${analysis.newChanges.length} · licensing changed: ${analysis.licensingChanged} · review due in ${analysis.reviewDueInDays} days`);
  await summary(env.GITHUB_STEP_SUMMARY, `# ${issue.title}\n\n${issue.body}`);

  if (!analysis.needsAttention) {
    log("Nothing needs attention; no issue opened.");
    return;
  }
  if (env.DRY_RUN === "1" || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
    log(`\n${issue.title}\n\n${issue.body}`);
    return;
  }
  log(`Issue: ${await upsertIssue({ token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY }, issue)}`);
}

main().catch((error: unknown) => {
  const message = error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : String(error);
  process.stderr.write(`legal-watch failed: ${message}\n`);
  process.exit(1);
});
