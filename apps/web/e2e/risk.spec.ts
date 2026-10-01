import { type Page, expect, test } from "@playwright/test";

// Runs against RISK_DATA_MODE=fixture (see playwright.config.ts and src/lib/risk/fixtures.ts).
const SANCTIONED = "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A";
const CLEAN_EOA = "0x1111111111111111111111111111111111111111";
const PROXY = "0x2222222222222222222222222222222222222222";
const FAILING = "0xdead000000000000000000000000000000000000";

async function check(page: Page, address: string, chain = "ethereum") {
  await page.goto("/rui-ro");
  await page.getByLabel("Mạng").selectOption(chain);
  await page.getByLabel("Địa chỉ ví hoặc hợp đồng").fill(address);
  await page.getByRole("button", { name: "Kiểm tra rủi ro" }).click();
}

test("sanctioned address is reported as high risk with its source", async ({ page }) => {
  await check(page, SANCTIONED);
  const report = page.getByTestId("risk-report");
  await expect(report).toHaveAttribute("data-level", "high");
  await expect(report).toContainText("Có trong danh sách trừng phạt OFAC (SDN)");
  await expect(report).toContainText("OFAC SDN");
});

test("clean EOA never claims to be safe", async ({ page }) => {
  await check(page, CLEAN_EOA, "bsc");
  const report = page.getByTestId("risk-report");
  await expect(report).toHaveAttribute("data-level", "low");
  await expect(report).toContainText("không có nghĩa là địa chỉ an toàn");
  await expect(report).toContainText("1,5 BNB");
});

test("upgradeable proxy is flagged for caution", async ({ page }) => {
  await check(page, PROXY, "base");
  await expect(page.getByTestId("risk-report")).toHaveAttribute("data-level", "medium");
  await expect(page.getByTestId("risk-report")).toContainText("Hợp đồng có thể nâng cấp (proxy)");
});

test("failing sources yield 'unknown', not 'low'", async ({ page }) => {
  await check(page, FAILING);
  await expect(page.getByTestId("risk-report")).toHaveAttribute("data-level", "unknown");
  await expect(page.getByTestId("risk-report")).toContainText("không phản hồi");
});

test("invalid address shows a validation error and the address never appears in the URL", async ({ page }) => {
  await check(page, "vitalik.eth");
  await expect(page.getByRole("alert").filter({ hasText: "Địa chỉ không hợp lệ" })).toBeVisible();
  expect(page.url()).not.toContain("vitalik");
});
