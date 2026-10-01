import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const isoDate = z.preprocess((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export interface KnownInstrument {
  readonly slug: string;
  readonly number: string;
  readonly title: string;
  readonly effectiveAt: string;
}

export interface KnownState {
  readonly reviewedAt: string;
  readonly nextReviewDue: string;
  readonly instruments: readonly KnownInstrument[];
  readonly licensing: { readonly asOf: string; readonly anyLicensed: boolean; readonly headline: string };
}

const InstrumentMeta = z.object({ number: z.string(), title: z.string(), effectiveAt: isoDate });
const RegisterMeta = z.object({ reviewedAt: isoDate, nextReviewDue: isoDate });
const Licensing = z.object({ asOf: isoDate, anyLicensed: z.boolean(), headline: z.string() });

/** What the public tracker currently says — the baseline the weekly scan compares against. */
export async function readKnownState(repoRoot: string): Promise<KnownState> {
  const legalDir = path.join(repoRoot, "content/phap-ly");
  const files = (await readdir(legalDir)).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const instruments = await Promise.all(
    files.map(async (f) => {
      const meta = InstrumentMeta.parse(matter(await readFile(path.join(legalDir, f), "utf8")).data);
      return { slug: f.slice(0, -3), ...meta };
    }),
  );
  const register = RegisterMeta.parse(matter(await readFile(path.join(repoRoot, "docs/LEGAL_REGISTER.md"), "utf8")).data);
  const licensing = Licensing.parse(JSON.parse(await readFile(path.join(legalDir, "_cap-phep.json"), "utf8")));
  return { ...register, instruments, licensing };
}
