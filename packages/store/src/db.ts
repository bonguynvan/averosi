import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

export type Sql = postgres.Sql;

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export function createSql(url: string): Sql {
  return postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 10, onnotice: () => undefined });
}

/** Applies pending migrations/*.sql in name order, each in its own transaction. Returns applied names. */
export async function migrate(sql: Sql): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const done = new Set((await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files.filter((f) => !done.has(f))) {
    const ddl = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(ddl);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    applied.push(file);
  }
  return applied;
}
