import { expect, test } from "@playwright/test";

// DATA_MODE=fixture uses the direct backend: live prices come from the (fixture) overview stream.

test("market page connects to the same-origin live stream", async ({ page }) => {
  await page.goto("/thi-truong");
  // Streamed (Suspense) market data + SSE handshake can exceed 5s when the whole suite runs in parallel.
  await expect(page.getByTestId("live-badge")).toHaveAttribute("data-status", "live", { timeout: 15_000 });
  await expect(page.getByTestId("live-badge")).toContainText("Trực tiếp");
  // Live cell keeps showing the VND reference price.
  await expect(page.locator('[data-live-symbol="BTC"]').first()).toContainText("₫");
});

test("asset page shows raw technical indicators (no signals)", async ({ page }) => {
  await page.goto("/tai-san/btc");
  const panel = page.getByTestId("technical-panel");
  await expect(panel).toContainText("RSI 14");
  await expect(panel).toContainText("Bollinger 20, 2σ");
  await expect(page.getByText("Không phải tín hiệu mua bán")).toBeVisible();
  const text = await panel.innerText();
  expect(text).not.toMatch(/quá mua|quá bán|overbought|oversold|nên mua|nên bán/i);
});

test("indicator API and SSE endpoint contracts", async ({ request }) => {
  const ok = await request.get("/api/phan-tich/btc?tf=1h");
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body).toMatchObject({ symbol: "BTC", timeframe: "1h" });
  expect(typeof body.snapshot.rsi14).toBe("number");
  expect(body.note).toContain("Không phải tín hiệu");

  expect((await request.get("/api/phan-tich/btc?tf=4h")).status()).toBe(400);
  expect((await request.get("/api/phan-tich/xyz")).status()).toBe(400);
});
