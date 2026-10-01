import { type AddressRiskReport, type CheckAddressRiskDeps, type CheckAddressRiskQuery, checkAddressRisk } from "@app/core";

export interface RiskService {
  check(query: CheckAddressRiskQuery): Promise<AddressRiskReport>;
}

export interface RiskServiceOptions {
  readonly deps: CheckAddressRiskDeps;
  readonly ttlMs: number;
  readonly now?: () => number;
}

/** Caches reports per chain+address (never per user) to protect free RPC quotas. */
export function createRiskService({ deps, ttlMs, now = Date.now }: RiskServiceOptions): RiskService {
  let cache = new Map<string, { readonly at: number; readonly report: AddressRiskReport }>();

  return {
    async check(query) {
      const key = `${query.chain}:${query.address}`;
      const t = now();
      const hit = cache.get(key);
      if (hit && t - hit.at < ttlMs) return hit.report;

      const report = await checkAddressRisk(deps, query);
      cache = new Map([...cache].filter(([, v]) => t - v.at < ttlMs)).set(key, { at: t, report });
      return report;
    },
  };
}

export type SerializedRiskReport = Omit<AddressRiskReport, "account" | "sources"> & {
  readonly account: (Omit<NonNullable<AddressRiskReport["account"]>, "balanceWei"> & { readonly balanceWei: string }) | null;
  readonly sources: readonly { readonly name: string; readonly status: "ok" | "failed"; readonly fetchedAt?: string }[];
};

/** Server actions must return plain JSON: bigint → decimal string, Date → ISO string. */
export function serializeReport(report: AddressRiskReport): SerializedRiskReport {
  return {
    ...report,
    account: report.account ? { ...report.account, balanceWei: report.account.balanceWei.toString() } : null,
    sources: report.sources.map((s) => ({
      name: s.name,
      status: s.status,
      ...(s.fetchedAt ? { fetchedAt: s.fetchedAt.toISOString() } : {}),
    })),
  };
}
