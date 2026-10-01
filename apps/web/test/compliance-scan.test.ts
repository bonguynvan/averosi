import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { findBannedCopy } from "@averosi/core";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "@/lib/paths";

const SCAN_ROOTS = ["apps/web/src", "content"];
const SCAN_EXT = /\.(tsx?|mdx?)$/;

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)]))),
  );
  return nested.flat().filter((f) => SCAN_EXT.test(f));
}

describe("banned copy (docs/DESIGN.md, LEGAL_REGISTER R3–R5)", () => {
  test("no UI source or content file contains banned copy", async () => {
    const files = (await Promise.all(SCAN_ROOTS.map((r) => listFiles(path.join(REPO_ROOT, r))))).flat();
    expect(files.length).toBeGreaterThan(0);

    const hits = await Promise.all(
      files.map(async (file) => ({
        file: path.relative(REPO_ROOT, file),
        hits: findBannedCopy(await readFile(file, "utf8")),
      })),
    );
    expect(hits.filter((h) => h.hits.length > 0)).toEqual([]);
  });
});
