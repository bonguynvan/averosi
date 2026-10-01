import { expect, test } from "@playwright/test";

test("learning hub lists articles, filters by topic, and articles link to our tools", async ({ page }) => {
  await page.goto("/kien-thuc");
  await expect(page.getByTestId("article-list").getByRole("listitem")).toHaveCount(6);

  await page.getByRole("navigation", { name: "Chủ đề" }).getByRole("link", { name: "Thuế" }).click();
  await expect(page).toHaveURL(/chu-de=thue$/);
  await expect(page.getByTestId("article-list").getByRole("listitem")).toHaveCount(1);

  await page.goto("/kien-thuc/nhan-dien-lua-dao");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("lừa đảo");
  await expect(page.getByTestId("article-body")).toContainText("EIP-7702");
  await page.getByRole("complementary", { name: "Liên quan" }).getByRole("link", { name: "Trung tâm rủi ro →" }).click();
  await expect(page).toHaveURL(/\/rui-ro$/);
});

test("unknown article is a 404", async ({ page }) => {
  expect((await page.goto("/kien-thuc/khong-co"))?.status()).toBe(404);
});
