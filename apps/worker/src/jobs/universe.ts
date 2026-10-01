import { buildUniverse } from "@app/core";
import { type ListingSource, collectListings } from "@app/market-data";
import type { AssetRepo } from "@app/store";

export interface UniverseJobDeps {
  readonly sources: readonly ListingSource[];
  readonly repo: AssetRepo;
  readonly minSources: number;
}

export interface UniverseResult {
  readonly assets: number;
  readonly upserted: number;
  readonly deactivated: number;
  readonly failedCatalogs: readonly string[];
}

/**
 * Rebuilds the asset universe from the exchanges' catalogs. If any catalog failed, nothing is
 * deactivated: an outage must not make assets disappear (they would only lose a source count).
 */
export async function runUniverse(deps: UniverseJobDeps): Promise<UniverseResult> {
  const { listings, failed } = await collectListings(deps.sources);
  if (failed.length === deps.sources.length) throw new Error("all exchange catalogs failed");
  const universe = buildUniverse(listings, { minSources: deps.minSources });
  const saved = await deps.repo.save(universe, { deactivateMissing: failed.length === 0 });
  return { assets: universe.length, ...saved, failedCatalogs: failed };
}
