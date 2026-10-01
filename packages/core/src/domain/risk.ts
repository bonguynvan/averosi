/**
 * Address risk scoring. Pure and deterministic; the methodology shown on /rui-ro mirrors these rules.
 * A "low" result only means no listed signal was found — never that an address is safe.
 */

export type RiskLevel = "high" | "medium" | "low" | "unknown";
export type Severity = "critical" | "warning" | "info";

export type FindingId =
  | "sanctioned"
  | "phishing-reported"
  | "upgradeable-proxy"
  | "eip7702-delegated"
  | "is-contract"
  | "no-outgoing-activity"
  | "check-failed";

export interface Finding {
  readonly id: FindingId;
  readonly severity: Severity;
  readonly source: string;
}

export interface AccountProfile {
  readonly kind: "eoa" | "contract";
  /** Number of transactions sent by the address (nonce). */
  readonly txCount: number;
  readonly balanceWei: bigint;
  /** A known proxy slot (EIP-1967, ZeppelinOS) is set: the contract's logic can be replaced by its admin. */
  readonly isUpgradeableProxy: boolean;
  readonly bytecodeSize: number;
  /** EIP-7702: the EOA delegates its code to this contract address. */
  readonly delegatedTo?: string;
}

export type CheckOutcome<T> =
  | { readonly status: "ok"; readonly value: T; readonly source: string; readonly fetchedAt: Date }
  | { readonly status: "failed"; readonly source: string };

export interface RiskCheckInput {
  readonly sanctions: CheckOutcome<boolean>;
  readonly phishing: CheckOutcome<boolean>;
  readonly account: CheckOutcome<AccountProfile>;
}

export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly findings: readonly Finding[];
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function listFindings(outcome: CheckOutcome<boolean>, hitId: FindingId): Finding[] {
  if (outcome.status === "failed") return [{ id: "check-failed", severity: "warning", source: outcome.source }];
  return outcome.value ? [{ id: hitId, severity: "critical", source: outcome.source }] : [];
}

function accountFindings(outcome: CheckOutcome<AccountProfile>): Finding[] {
  if (outcome.status === "failed") return [{ id: "check-failed", severity: "info", source: outcome.source }];
  const { value, source } = outcome;
  if (value.kind === "contract") {
    const proxy: Finding[] = value.isUpgradeableProxy ? [{ id: "upgradeable-proxy", severity: "warning", source }] : [];
    return [...proxy, { id: "is-contract", severity: "info", source }];
  }
  const delegated: Finding[] = value.delegatedTo ? [{ id: "eip7702-delegated", severity: "info", source }] : [];
  const fresh: Finding[] = value.txCount === 0 ? [{ id: "no-outgoing-activity", severity: "info", source }] : [];
  return [...delegated, ...fresh];
}

function levelOf(findings: readonly Finding[], input: RiskCheckInput): RiskLevel {
  if (findings.some((f) => f.severity === "critical")) return "high";
  if (input.sanctions.status === "failed" || input.phishing.status === "failed") return "unknown";
  if (findings.some((f) => f.severity === "warning")) return "medium";
  return "low";
}

export function scoreRisk(input: RiskCheckInput): RiskAssessment {
  const findings = [
    ...listFindings(input.sanctions, "sanctioned"),
    ...listFindings(input.phishing, "phishing-reported"),
    ...accountFindings(input.account),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return { level: levelOf(findings, input), findings };
}
