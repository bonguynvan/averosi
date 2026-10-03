import { expect, test } from "@playwright/test";

// DATA_MODE=fixture: Coinbase/Kraken/Bitstamp ok, Gemini down, FX 25.780 ₫/USD (src/lib/market/fixtures.ts).

// Server HTML (what crawlers index, and the first paint before the live grid takes over).
test("server HTML carries the reference table with sources and FX attribution", async ({ request }) => {
  // React separates adjacent text nodes with <!-- --> in server HTML.
  const html = (await (await request.get("/thi-truong")).text()).replaceAll("<!-- -->", "");
  expect(html).toContain('data-testid="market-table"');
  // median of 83.5k × {1.001, 1, 0.999} = 83.500 USD × 25.780 = 2.152.630.000 ₫
  expect(html).toContain("2.152.630.000 ₫");
  expect(html).toContain("-1,20%");
  expect(html).toMatch(/Tỷ giá 25\.780 ₫\/USD · Vietcombank \(USD chuyển khoản\)/);
  expect(html).toContain("Tên sàn chỉ để ghi nguồn dữ liệu");
});

test("server table: search and sort via URL, never by gains", async ({ request }) => {
  const rowsOf = (html: string) => [...html.matchAll(/href="\/tai-san\/([a-z0-9]+)"/g)].map((m) => m[1]);
  const search = await (await request.get("/thi-truong?q=bitcoin")).text();
  expect(rowsOf(search)).toEqual(["btc"]);
  expect(search.replaceAll("<!-- -->", "")).toContain("kết quả cho “bitcoin”");
  const sorted = await (await request.get("/thi-truong?sap-xep=ma")).text();
  expect(rowsOf(sorted)[0]).toBe("ada");
  expect(sorted).toContain('aria-current="true"');
  expect(sorted).not.toMatch(/sap-xep=(bien-dong|tang|giam)/);
  expect((await (await request.get("/thi-truong?q=khong-ton-tai")).text())).toContain("Không có tài sản nào khớp.");
});

test("no outbound links to exchanges anywhere on market pages", async ({ page }) => {
  for (const path of ["/", "/thi-truong", "/tai-san/btc"]) {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(hrefs.filter((h) => /coinbase|kraken|bitstamp|gemini|binance/i.test(h))).toEqual([]);
  }
});

test("asset detail renders a read-only candle chart from the same-origin proxy", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  const candleRequests = () => requested.filter((u) => u.includes("/api/nen/"));

  await page.goto("/thi-truong");
  await page.getByTestId("market-grid").getByRole("link", { name: /^BTC/ }).click();
  await expect(page).toHaveURL(/\/tai-san\/btc$/);
  await expect(page.getByTestId("asset-price")).toContainText("2.152.630.000 ₫");
  await expect(page.getByTestId("chart-source")).toContainText("Nến BTC/USD · nguồn Coinbase");
  await expect(page.getByTestId("price-chart").locator("canvas").first()).toBeVisible();

  await page.getByRole("button", { name: "1 ngày" }).click();
  await expect(page.getByRole("button", { name: "1 ngày" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => candleRequests().some((u) => u.includes("tf=1d"))).toBe(true);
  // The visitor's browser only ever talks to our own origin (no exchange, CDN or tracker).
  expect(new Set(requested.map((u) => new URL(u).host))).toEqual(new Set(["localhost:3100"]));
});

test("unknown asset is a 404 and candle API validates input", async ({ page, request }) => {
  expect((await page.goto("/tai-san/khong-co"))?.status()).toBe(404);
  expect((await request.get("/api/nen/BTC?tf=4h")).status()).toBe(400);
  expect((await request.get("/api/nen/XYZ")).status()).toBe(400);
  const ok = await request.get("/api/nen/eth?tf=1h");
  expect(ok.status()).toBe(200);
  expect((await ok.json()).bars.length).toBeGreaterThan(0);
});

test("live grid replaces the table: all assets, instant search, no sort by 24h change, same-origin only", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto("/thi-truong");
  const grid = page.getByTestId("market-grid");
  await expect(grid).toBeVisible();
  await expect(page.getByTestId("market-table")).toHaveCount(0);
  await expect(grid.getByRole("status")).toContainText("14 tài sản");
  await expect(grid).toContainText("2.152.630.000 ₫");

  await page.getByRole("searchbox", { name: "Tìm theo mã hoặc tên tài sản" }).fill("bitcoin");
  await expect(grid.getByRole("link", { name: /^BTC/ })).toBeVisible();
  await expect(grid.getByRole("link", { name: /^ETH/ })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Tìm theo mã hoặc tên tài sản" }).fill("");

  // R4: ranking by gains is not offered.
  const change = grid.getByRole("columnheader").filter({ hasText: "24h" }).filter({ hasNotText: "KL" });
  await change.click();
  await expect(change).not.toHaveAttribute("aria-sort", /ascending|descending/);
  const price = grid.getByRole("columnheader").filter({ hasText: /^Giá VNĐ/ });
  await price.click();
  await expect(price).toHaveAttribute("aria-sort", /ascending|descending/);

  await grid.getByRole("link", { name: /^BTC/ }).click();
  await expect(page).toHaveURL(/\/tai-san\/btc$/);
  expect(new Set(requested.map((u) => new URL(u).host))).toEqual(new Set(["localhost:3100"]));
});
