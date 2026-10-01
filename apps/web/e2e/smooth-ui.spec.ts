import { expect, test } from "@playwright/test";

test.describe("desktop shell", () => {
  test.use({ viewport: { width: 1280, height: 640 } });

  test("legal bar, sidebar and table header stay pinned while the page scrolls", async ({ page }) => {
    await page.goto("/thi-truong");
    const readShellTop = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ds-shell-top")) || 0);
    // Published by ShellMetrics after hydration.
    await expect.poll(readShellTop).toBeGreaterThan(50);
    const shellTop = await readShellTop();

    // Scroll part-way: at the very bottom the footer legitimately pushes the sticky sidebar up.
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);

    const legal = await page.getByTestId("legal-bar").boundingBox();
    expect(legal?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect(legal?.y ?? 999).toBeLessThan(shellTop);

    const nav = await page.getByRole("navigation", { name: "Điều hướng chính", exact: true }).boundingBox();
    expect(Math.round(nav?.y ?? -1)).toBe(Math.round(shellTop));

    const th = await page.getByTestId("market-table").getByRole("columnheader", { name: "Giá VNĐ" }).boundingBox();
    expect(Math.round(th?.y ?? -1)).toBe(Math.round(shellTop));
  });

  test("collapsible panels toggle with proper ARIA state; legal notices are not collapsible", async ({ page }) => {
    await page.goto("/thi-truong");
    const toggle = page.getByRole("button", { name: "Cách tính" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Quy đổi VNĐ theo tỷ giá USD chuyển khoản")).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Quy đổi VNĐ theo tỷ giá USD chuyển khoản")).toBeHidden();

    await toggle.click();
    await expect(page.getByText("Quy đổi VNĐ theo tỷ giá USD chuyển khoản")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu ý pháp lý" })).toHaveCount(0);
  });
});

test("reduced motion: no enter animation, sidebar still toggles instantly", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto("/thue");
  const animation = await page.locator("main > div").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("none");

  await page.getByRole("button", { name: "Thu gọn thanh bên" }).click();
  await expect(page.getByRole("navigation", { name: "Điều hướng chính", exact: true })).toHaveAttribute("data-collapsed", "true");
  await context.close();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test("legal bar is compact but never truncated; nav keeps the active item in view", async ({ page }) => {
    await page.goto("/kien-thuc");
    await page.evaluate(() => document.fonts.ready);
    const bar = page.getByTestId("legal-bar");
    expect((await bar.boundingBox())?.height ?? 999).toBeLessThan(48);
    const clipped = await bar.locator("p").evaluate((p) => p.scrollWidth > p.clientWidth || getComputedStyle(p).textOverflow === "ellipsis");
    expect(clipped).toBe(false);
    await expect(page.getByTestId("legal-bar").getByRole("link", { name: "Chi tiết" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Điều hướng chính (di động)" });
    const active = nav.getByRole("link", { name: /Kiến thức/ });
    await expect(active).toHaveAttribute("aria-current", "page");
    await expect.poll(async () => {
      const box = await active.boundingBox();
      return box !== null && box.x >= 0 && box.x + box.width <= 375;
    }).toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
