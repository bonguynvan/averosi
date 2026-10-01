import { type Page, expect, test } from "@playwright/test";

// Fixtures (DATA_MODE=fixture): EOA with 1.5 native, 7 txs; first stablecoin 1,234.5, second unavailable.
const CLEAN = "0x1111111111111111111111111111111111111111";
const SANCTIONED = "0x0330070FD38Ec3bB94F58FA55D40368271E9e54A";
const ACCOUNT = "0x3333333333333333333333333333333333333333";

test.use({ viewport: { width: 1440, height: 900 } });

async function addWallet(page: Page, address: string, note?: string, chain = "ethereum") {
  await page.getByRole("combobox", { name: "Mạng" }).selectOption(chain);
  await page.getByLabel("Địa chỉ công khai").fill(address);
  if (note) await page.getByLabel("Ghi chú (tùy chọn)").fill(note);
  await page.getByRole("button", { name: "Thêm ví" }).click();
}

test("watch public wallets: balances, stablecoins (amounts only), risk flag, persistence, removal", async ({ page }) => {
  await page.goto("/vi");
  await expect(page.getByTestId("watch-empty")).toBeVisible();

  await addWallet(page, "0x12");
  await expect(page.getByRole("alert").filter({ hasText: "Địa chỉ không hợp lệ" })).toBeVisible();

  await addWallet(page, CLEAN, "Ví lạnh");
  const card = page.getByTestId("wallet-card").first();
  await expect(card).toContainText("Ví lạnh");
  await expect(card).toContainText("1,5");
  await expect(card).toContainText("USDT");
  await expect(card).toContainText("1.234,5");
  await expect(card).toContainText("≈"); // native value in VND (reference)
  await expect(card).not.toContainText("USDT ≈");

  await addWallet(page, SANCTIONED);
  await expect(page.getByTestId("wallet-card").nth(1)).toContainText("Có trong danh sách trừng phạt OFAC");

  await addWallet(page, CLEAN, "trùng");
  await expect(page.getByRole("alert").filter({ hasText: "đã có trong danh sách" })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("wallet-card")).toHaveCount(2); // stored in this browser

  await page.getByRole("button", { name: "Bỏ theo dõi Ví lạnh" }).click();
  await expect(page.getByTestId("wallet-card")).toHaveCount(1);
});

test("wallet addresses are sent by POST, never in URLs", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto("/vi");
  await addWallet(page, CLEAN);
  await expect(page.getByTestId("wallet-card")).toHaveCount(1);
  expect(urls.filter((u) => u.toLowerCase().includes(CLEAN.slice(2, 12)))).toEqual([]);
});

test("no wallet installed: neutral guidance and the read-only safety note", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await expect(page.getByTestId("no-wallet")).toBeVisible();
  await expect(page.getByText("Không bao giờ yêu cầu chữ ký, cụm từ khôi phục hay chuyển tiền")).toBeVisible();
});

test("EIP-6963 wallet: discover, connect (read-only), watch my wallet", async ({ page }) => {
  await page.addInitScript((account: string) => {
    // Behaves like a real wallet: no accounts are exposed until the user approves eth_requestAccounts.
    let authorized = false;
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") {
          authorized = true;
          return [account];
        }
        if (method === "eth_accounts") return authorized ? [account] : [];
        if (method === "eth_chainId") return "0x1";
        if (method === "wallet_requestPermissions" || method === "wallet_revokePermissions") return [];
        throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 });
      },
      on: () => undefined,
      removeListener: () => undefined,
    };
    const detail = Object.freeze({
      info: { uuid: "6f1c1c2e-0000-4000-8000-000000000001", name: "Ví Thử", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "test.wallet" },
      provider,
    });
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  }, ACCOUNT);

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.getByRole("button", { name: "Ví Thử" }).click();
  await expect(page.getByTestId("connect-wallet")).toContainText("0x3333…3333");

  await page.getByTestId("connect-wallet").click();
  await page.getByRole("link", { name: "Theo dõi ví này" }).click();
  await expect(page).toHaveURL(/\/vi\?ket-noi=1$/);
  await expect(page.getByTestId("wallet-card").first()).toContainText("Ví của tôi");
});
