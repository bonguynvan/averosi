import { type Page, expect, test } from "@playwright/test";

// Fixtures (DATA_MODE=fixture): any owner has (1) unlimited USDT → 0x2222…2222 and
// (2) an NFT operator approval to the OFAC-listed fixture address.
const OWNER = "0x3333333333333333333333333333333333333333";
const TOKEN = "0x00000000000000000000000000000000000000b1";
const SPENDER = "0x2222222222222222222222222222222222222222";

test.use({ viewport: { width: 1440, height: 900 } });

/** Realistic EIP-6963 wallet: accounts only after approval; records eth_sendTransaction; mines instantly. */
async function installWallet(page: Page) {
  await page.addInitScript((account: string) => {
    const w = window as unknown as { __sent: unknown[] };
    w.__sent = [];
    let authorized = false;
    const HASH = `0x${"ab".repeat(32)}`;
    const receipt = {
      blockHash: `0x${"cd".repeat(32)}`,
      blockNumber: "0x100",
      contractAddress: null,
      cumulativeGasUsed: "0x5208",
      effectiveGasPrice: "0x1",
      from: account,
      gasUsed: "0x5208",
      logs: [],
      logsBloom: `0x${"00".repeat(256)}`,
      status: "0x1",
      to: null,
      transactionHash: HASH,
      transactionIndex: "0x0",
      type: "0x2",
    };
    const provider = {
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        switch (method) {
          case "eth_requestAccounts":
            authorized = true;
            return [account];
          case "eth_accounts":
            return authorized ? [account] : [];
          case "eth_chainId":
            return "0x1";
          case "eth_sendTransaction":
            w.__sent.push(params?.[0]);
            return HASH;
          case "eth_blockNumber":
            return "0x101";
          case "eth_getTransactionReceipt":
            return receipt;
          case "eth_getTransactionByHash":
            return { hash: HASH, blockNumber: "0x100", from: account, to: null, input: "0x", nonce: "0x0", value: "0x0", gas: "0x5208", type: "0x2", chainId: "0x1" };
          default:
            throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 });
        }
      },
      on: () => undefined,
      removeListener: () => undefined,
    };
    const detail = Object.freeze({ info: { uuid: "6f1c1c2e-0000-4000-8000-000000000002", name: "Ví Thử", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "test.wallet" }, provider });
    const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  }, OWNER);
}

test("scan shows active approvals with spender risk; no revoke without the owner's wallet", async ({ page }) => {
  await page.goto("/quyen");
  await page.getByLabel("Địa chỉ ví").fill(OWNER);
  await page.getByRole("button", { name: "Quét quyền" }).click();
  const result = page.getByTestId("approvals-result");
  await expect(result).toHaveAttribute("data-status", "complete");
  await expect(page.getByTestId("approval-row")).toHaveCount(2);
  await expect(result).toContainText("Không giới hạn");
  await expect(result).toContainText("Trừng phạt OFAC");
  await expect(result.getByText("Kết nối đúng ví chủ sở hữu để thu hồi").first()).toBeVisible();
});

test("revoke: exact approve(spender, 0) calldata is sent to the token, then a fresh re-scan", async ({ page }) => {
  await installWallet(page);
  const bodies: { fresh?: boolean }[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/quyen") && r.method() === "POST") bodies.push(JSON.parse(r.postData() ?? "{}"));
  });

  await page.goto("/quyen");
  await page.getByTestId("connect-wallet").click();
  await page.getByRole("button", { name: "Ví Thử" }).click();
  await expect(page.getByTestId("connect-wallet")).toContainText("0x3333…3333");

  await expect(page.getByLabel("Địa chỉ ví")).toHaveValue(OWNER); // prefilled from the connected wallet
  await page.getByRole("button", { name: "Quét quyền" }).click();
  const usdtRow = page.getByTestId("approval-row").filter({ hasText: "USDT" });
  await usdtRow.getByRole("button", { name: "Thu hồi" }).click();
  await expect(usdtRow).toContainText(`approve(${SPENDER}, 0)`);
  await usdtRow.getByRole("button", { name: "Ký thu hồi" }).click();

  await expect.poll(() => page.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent.length)).toBe(1);
  const [tx] = (await page.evaluate(() => (window as unknown as { __sent: { to: string; data: string; value?: string }[] }).__sent)) as { to: string; data: string; value?: string }[];
  expect(tx?.to.toLowerCase()).toBe(TOKEN);
  expect(tx?.data).toBe(`0x095ea7b3${SPENDER.slice(2).padStart(64, "0")}${"0".repeat(64)}`);
  expect(BigInt(tx?.value ?? "0x0")).toBe(0n); // never moves funds

  await expect.poll(() => bodies.some((b) => b.fresh === true)).toBe(true);
});
