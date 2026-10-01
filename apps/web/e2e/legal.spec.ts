import { expect, test } from "@playwright/test";

test("legal tracker lists instruments with status, filters by category via URL", async ({ page }) => {
  await page.goto("/phap-ly");
  await expect(page.getByTestId("legal-card")).toHaveCount(7);
  await expect(page.getByTestId("licensing-status")).toHaveText("Chưa có tổ chức nào được cấp phép chính thức");

  await page.getByRole("navigation", { name: "Lọc theo nhóm" }).getByRole("link", { name: "Thuế" }).click();
  await expect(page).toHaveURL(/\?nhom=thue$/);
  await expect(page.getByTestId("legal-card")).toHaveCount(2);
  await expect(page.getByRole("navigation", { name: "Lọc theo nhóm" }).getByRole("link", { name: "Thuế" })).toHaveAttribute("aria-current", "page");

  // Unknown filter values are ignored, not errors.
  await page.goto("/phap-ly?nhom=khong-co");
  await expect(page.getByTestId("legal-card")).toHaveCount(7);
});

test("instrument detail shows dates, impacts, penalty table and official sources", async ({ page }) => {
  await page.goto("/phap-ly/nghi-dinh-284-2026-nd-cp");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("xử phạt vi phạm hành chính");
  await expect(page.getByText("Đang hiệu lực").first()).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("180–200 triệu đồng");

  const sources = page.getByTestId("legal-sources").getByRole("link");
  await expect(sources).toHaveCount(3);
  for (const link of await sources.all()) {
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).toHaveAttribute("href", /^https:\/\//);
  }
});

test("unknown instrument is a real 404", async ({ page }) => {
  expect((await page.goto("/phap-ly/khong-ton-tai"))?.status()).toBe(404);
});
