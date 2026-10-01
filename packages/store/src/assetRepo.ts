import type { UniverseAsset } from "@app/core";
import type { Sql } from "./db";

export interface AssetRepo {
  /**
   * Upserts the discovered universe. With `deactivateMissing`, assets no longer listed are marked
   * inactive (kept for history). Only pass it when every catalog was read successfully.
   */
  save(universe: readonly UniverseAsset[], opts: { readonly deactivateMissing: boolean }): Promise<{ upserted: number; deactivated: number }>;
  /** Active assets, ordered by symbol. */
  active(): Promise<UniverseAsset[]>;
}

export function createAssetRepo(sql: Sql): AssetRepo {
  return {
    async save(universe, { deactivateMissing }) {
      if (universe.length === 0) return { upserted: 0, deactivated: 0 };
      return sql.begin(async (tx) => {
        const rows = universe.map((a) => ({ symbol: a.symbol, name: a.name, sources: [...a.sources], venues: tx.json({ ...a.venues }), active: true }));
        const upserted = await tx`
          INSERT INTO assets ${tx(rows)}
          ON CONFLICT (symbol) DO UPDATE SET
            name = EXCLUDED.name, sources = EXCLUDED.sources, venues = EXCLUDED.venues, active = true, updated_at = now()`;
        const deactivated = deactivateMissing
          ? await tx`UPDATE assets SET active = false, updated_at = now() WHERE active AND NOT (symbol = ANY(${universe.map((a) => a.symbol)}))`
          : { count: 0 };
        return { upserted: upserted.count, deactivated: deactivated.count };
      });
    },

    async active() {
      const rows = await sql<{ symbol: string; name: string; sources: string[]; venues: Record<string, string> }[]>`
        SELECT symbol, name, sources, venues FROM assets WHERE active ORDER BY symbol`;
      return rows.map((r) => ({ symbol: r.symbol, name: r.name, sources: r.sources, venues: r.venues }));
    },
  };
}
