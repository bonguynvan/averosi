import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { readKnownState } from "../src/state";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("readKnownState (real repository files)", () => {
  test("reads instruments, review dates and licensing status", async () => {
    const state = await readKnownState(REPO_ROOT);
    expect(state.instruments.length).toBeGreaterThanOrEqual(7);
    expect(state.instruments.map((i) => i.number)).toContain("284/2026/NĐ-CP");
    expect(state.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(state.nextReviewDue >= state.reviewedAt).toBe(true);
    expect(typeof state.licensing.anyLicensed).toBe("boolean");
  });
});
