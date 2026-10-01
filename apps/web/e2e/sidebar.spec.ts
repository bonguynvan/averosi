import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("sidebar collapses to an icon rail, widens the workspace and remembers the choice", async ({ page }) => {
  await page.goto("/rui-ro");
  const nav = page.getByRole("navigation", { name: "Điều hướng chính", exact: true });
  const main = page.locator("main");
  const wideBefore = (await main.boundingBox())?.width ?? 0;

  await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  await expect(nav).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByRole("button", { name: "Mở rộng thanh bên" })).toHaveAttribute("aria-expanded", "false");
  expect((await main.boundingBox())?.width ?? 0).toBeGreaterThan(wideBefore + 150);

  // Icon-only links keep accessible names.
  await expect(nav.getByRole("link", { name: "Công cụ thuế 0,1%" })).toBeVisible();

  await page.reload();
  await expect(nav).toHaveAttribute("data-collapsed", "true");

  await page.getByRole("button", { name: "Mở rộng thanh bên" }).click();
  await expect(nav).toHaveAttribute("data-collapsed", "false");
});
