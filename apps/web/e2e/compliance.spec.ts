import { findBannedCopy } from "@app/core";
import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/tai-san/btc", "/rui-ro", "/vi", "/thue", "/phap-ly", "/kien-thuc", "/mien-tru-trach-nhiem", "/dieu-khoan", "/quyen-rieng-tu", "/thay-doi-chinh-sach"];
const VIEWPORTS = [320, 768, 1024, 1440];

for (const route of ROUTES) {
  test(`${route}: legal bar, footer policy links, no banned copy`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("legal-bar")).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Miễn trừ trách nhiệm" })).toBeVisible();

    const text = await page.locator("body").innerText();
    expect(findBannedCopy(text)).toEqual([]);
  });
}

test("every response carries a nonce-based CSP", async ({ page }) => {
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
});

for (const width of VIEWPORTS) {
  test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/thue");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("unknown route returns 404", async ({ page }) => {
  const response = await page.goto("/khong-ton-tai");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("legal-bar")).toBeVisible();
});
