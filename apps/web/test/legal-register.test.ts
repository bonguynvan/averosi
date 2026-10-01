import { readFile } from "node:fs/promises";
import path from "node:path";
import { isReviewOverdue } from "@app/core";
import matter from "gray-matter";
import { describe, expect, test } from "vitest";
import { REPO_ROOT } from "@/lib/paths";

describe("docs/LEGAL_REGISTER.md", () => {
  test("is not past its review date — re-check Vietnamese law and update the register", async () => {
    const raw = await readFile(path.join(REPO_ROOT, "docs/LEGAL_REGISTER.md"), "utf8");
    const { data } = matter(raw);
    const due = data.nextReviewDue instanceof Date ? data.nextReviewDue.toISOString().slice(0, 10) : String(data.nextReviewDue);
    expect(isReviewOverdue(due, new Date()), `LEGAL_REGISTER review overdue since ${due}`).toBe(false);
  });
});
