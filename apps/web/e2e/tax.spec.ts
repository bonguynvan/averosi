import { expect, test } from "@playwright/test";

test("tax calculator estimates 0.1% and validates input", async ({ page }) => {
  await page.goto("/thue");
  const input = page.getByLabel("Giá trị mỗi lần chuyển nhượng (VNĐ)");

  await input.fill("100.000.000");
  await expect(page.getByTestId("tax-amount")).toHaveText("100.000 ₫");

  await input.fill("12abc");
  await expect(page.getByRole("alert").filter({ hasText: "Chỉ nhập số nguyên dương" })).toBeVisible();
  await expect(page.getByTestId("tax-amount")).toHaveText("—");
});

test("active navigation item is marked with aria-current", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/thue");
  await expect(page.getByRole("navigation", { name: "Điều hướng chính", exact: true }).getByRole("link", { name: /Công cụ thuế/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
