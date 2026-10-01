import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("full chart terminal: widget renders read-only, data only via our origin", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));

  await page.goto("/bieu-do?ma=ETH");
  const terminal = page.getByTestId("chart-terminal");
  await expect(terminal.locator("canvas").first()).toBeVisible();
  await expect(page.getByTestId("chart-attribution")).toContainText("không phải báo giá giao dịch");

  // Toolbar with our timeframes is present.
  for (const tf of ["1m", "5m", "15m", "1H", "1D"]) {
    await expect(terminal.getByText(tf, { exact: true }).first()).toBeVisible();
  }

  // Read-only: no trading surface.
  await expect(terminal.getByRole("button", { name: /^(buy|sell|mua|bán)$/i })).toHaveCount(0);

  // Watchlist is fed from one aggregated request.
  await expect.poll(() => requested.filter((u) => u.includes("/api/thi-truong")).length).toBeGreaterThan(0);
  await expect.poll(() => requested.some((u) => u.includes("/api/nen/ETH?tf=1h"))).toBe(true);

  const hosts = new Set(requested.map((u) => new URL(u).host));
  expect(hosts).toEqual(new Set(["localhost:3100"]));
});

test("asset page links to the full terminal for the same symbol", async ({ page }) => {
  await page.goto("/tai-san/btc");
  await page.getByRole("link", { name: "Mở biểu đồ đầy đủ →" }).click();
  await expect(page).toHaveURL(/\/bieu-do\?ma=BTC$/);
});

test("unknown symbol falls back to BTC instead of erroring", async ({ page }) => {
  const res = await page.goto("/bieu-do?ma=khong-co");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("chart-terminal").locator("canvas").first()).toBeVisible();
});
