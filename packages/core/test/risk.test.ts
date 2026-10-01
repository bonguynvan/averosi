import { describe, expect, test } from "vitest";
import { type RiskCheckInput, scoreRisk } from "../src/domain/risk";

const AT = new Date("2026-10-01T00:00:00Z");
const ok = <T>(value: T, source = "src") => ({ status: "ok" as const, value, source, fetchedAt: AT });
const failed = (source = "src") => ({ status: "failed" as const, source });

const EOA_ACTIVE = { kind: "eoa" as const, txCount: 12, balanceWei: 10n ** 18n, isUpgradeableProxy: false, bytecodeSize: 0 };

function input(overrides: Partial<RiskCheckInput> = {}): RiskCheckInput {
  return { sanctions: ok(false), phishing: ok(false), account: ok(EOA_ACTIVE), ...overrides };
}

const ids = (input: RiskCheckInput) => scoreRisk(input).findings.map((f) => f.id);

describe("scoreRisk", () => {
  test("clean, active EOA with all checks ok → low, no findings except none", () => {
    expect(scoreRisk(input())).toEqual({ level: "low", findings: [] });
  });

  test("OFAC hit → high with critical finding", () => {
    const report = scoreRisk(input({ sanctions: ok(true, "OFAC SDN") }));
    expect(report.level).toBe("high");
    expect(report.findings[0]).toMatchObject({ id: "sanctioned", severity: "critical", source: "OFAC SDN" });
  });

  test("phishing report → high", () => {
    expect(scoreRisk(input({ phishing: ok(true, "ScamSniffer") })).level).toBe("high");
    expect(ids(input({ phishing: ok(true) }))).toContain("phishing-reported");
  });

  test("upgradeable proxy contract → medium", () => {
    const account = ok({ ...EOA_ACTIVE, kind: "contract" as const, isUpgradeableProxy: true, bytecodeSize: 200 });
    const report = scoreRisk(input({ account }));
    expect(report.level).toBe("medium");
    expect(report.findings.map((f) => f.id)).toEqual(["upgradeable-proxy", "is-contract"]);
  });

  test("plain contract and fresh EOA are informational only → low", () => {
    expect(scoreRisk(input({ account: ok({ ...EOA_ACTIVE, kind: "contract" as const, bytecodeSize: 100 }) })).level).toBe("low");
    const fresh = scoreRisk(input({ account: ok({ ...EOA_ACTIVE, txCount: 0, balanceWei: 0n }) }));
    expect(fresh).toMatchObject({ level: "low", findings: [{ id: "no-outgoing-activity", severity: "info" }] });
  });

  test("EIP-7702 delegated EOA is reported as information, not as a contract", () => {
    const account = ok({ ...EOA_ACTIVE, bytecodeSize: 23, delegatedTo: "0x5a7fc11397e9a8ad41bf10bf13f22b0a63f96f6d" });
    expect(scoreRisk(input({ account }))).toEqual({
      level: "low",
      findings: [{ id: "eip7702-delegated", severity: "info", source: "src" }],
    });
  });

  test("a failed list check means we cannot conclude → unknown", () => {
    const report = scoreRisk(input({ sanctions: failed("OFAC SDN") }));
    expect(report.level).toBe("unknown");
    expect(report.findings).toContainEqual(expect.objectContaining({ id: "check-failed", severity: "warning", source: "OFAC SDN" }));
  });

  test("a critical hit still wins over a failed check", () => {
    expect(scoreRisk(input({ sanctions: ok(true), phishing: failed() })).level).toBe("high");
  });

  test("failed account lookup alone keeps list-based conclusion but is reported", () => {
    const report = scoreRisk(input({ account: failed("RPC") }));
    expect(report.level).toBe("low");
    expect(report.findings).toContainEqual(expect.objectContaining({ id: "check-failed", severity: "info", source: "RPC" }));
  });

  test("findings are ordered by severity", () => {
    const account = ok({ ...EOA_ACTIVE, kind: "contract" as const, isUpgradeableProxy: true, bytecodeSize: 1 });
    const severities = scoreRisk(input({ sanctions: ok(true), account })).findings.map((f) => f.severity);
    expect(severities).toEqual(["critical", "warning", "info"]);
  });
});
