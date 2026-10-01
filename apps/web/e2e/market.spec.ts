import { expect, test } from "@playwright/test";

// DATA_MODE=fixture: Coinbase/Kraken/Bitstamp ok, Gemini down, FX 25.780 ₫/USD (src/lib/market/fixtures.ts).

test("market overview shows VND reference prices with sources and FX attribution", async ({ page }) => {
  await page.goto("/thi-truong");
  const table = page.getByTestId("market-table");
  await expect(table.getByRole("rowheader", { name: /BTC/ })).toBeVisible();
  // median of 83.5k × {1.001, 1, 0.999} = 83.500 USD × 25.780 = 2.152.630.000 ₫
  await expect(table).toContainText("2.152.630.000 ₫");
  await expect(table).toContainText("▼ -1,20%");

  const sources = page.getByTestId("market-sources");
  await expect(sources).toContainText("Tỷ giá 25.780 ₫/USD · Vietcombank (USD chuyển khoản)");
  await expect(sources).toContainText("Gemini · không phản hồi");
  await expect(page.getByText("Tên sàn chỉ để ghi nguồn dữ liệu")).toBeVisible();
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
  await page.getByTestId("market-table").getByRole("link", { name: /BTC/ }).click();
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

test("market table: search (ticker or name, accent-insensitive), sort via URL, no sort by gains", async ({ page }) => {
  await page.goto("/thi-truong");
  await expect(page.getByRole("status").filter({ hasText: "tài sản ·" })).toContainText("niêm yết cặp USD pháp định trên ≥ 2 nguồn");

  await page.getByRole("searchbox", { name: "Tìm theo mã hoặc tên tài sản" }).fill("bitcoin");
  await page.getByRole("button", { name: "Tìm" }).click();
  await expect(page).toHaveURL(/\/thi-truong\?q=bitcoin$/);
  const rows = page.getByTestId("market-table").getByRole("rowheader");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("BTC");

  await page.getByRole("link", { name: "Mã A→Z" }).click();
  await expect(page).toHaveURL(/\/thi-truong\?q=bitcoin&sap-xep=ma$/);
  await expect(page.getByRole("link", { name: "Mã A→Z" })).toHaveAttribute("aria-current", "true");

  await page.goto("/thi-truong?sap-xep=ma");
  await expect(rows.first()).toContainText("ADA");
  await expect(page.getByRole("navigation", { name: "Sắp xếp" })).not.toContainText(/tăng|giảm|biến động/i);

  await page.goto("/thi-truong?q=khong-ton-tai");
  await expect(page.getByText("Không có tài sản nào khớp.")).toBeVisible();
});
