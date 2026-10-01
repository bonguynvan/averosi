import { expect, test } from "@playwright/test";

test("landing: hero, compliant CTAs, VND board with tabs, stats, highlights", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Giá crypto bằng VNĐ");

  // CTAs lead to our own read-only tools, never to trading.
  await expect(page.getByRole("link", { name: "Xem thị trường →" })).toHaveAttribute("href", "/thi-truong");
  await expect(page.getByRole("link", { name: "Kiểm tra ví" })).toHaveAttribute("href", "/rui-ro");
  await expect(page.getByRole("link", { name: /mua|đăng ký|nạp tiền/i })).toHaveCount(0);

  const board = page.getByTestId("price-board");
  await expect(board.getByRole("tab", { name: "Khối lượng lớn" })).toHaveAttribute("aria-selected", "true");
  await expect(board).toContainText("2.152.630.000 ₫");
  await board.getByRole("tab", { name: "Biến động mạnh (±)" }).click();
  await expect(board.getByRole("tab", { name: "Biến động mạnh (±)" })).toHaveAttribute("aria-selected", "true");
  // ETH has the largest absolute move in fixtures (-1,20%), so it leads this tab even though it fell.
  await expect(board.getByRole("listitem").first()).toContainText("ETH");

  await expect(page.getByRole("region", { name: "Chỉ số tổng quan" })).toContainText("25.780 ₫");
  await expect(page.getByRole("region", { name: "Nổi bật 24 giờ" }).getByRole("heading")).toHaveText([
    "Khối lượng 24h lớn nhất",
    "Biến động 24h mạnh nhất",
    "Độ lệch giữa các nguồn",
  ]);
});

test("landing: legal timeline links into the legal module; FAQ toggles", async ({ page }) => {
  await page.goto("/");
  const timeline = page.getByRole("region", { name: "Pháp lý tài sản mã hóa tại Việt Nam" });
  await expect(timeline).toContainText("Chưa có tổ chức nào được cấp phép chính thức".toLowerCase());
  await timeline.getByRole("link", { name: /Xử phạt vi phạm về tài sản mã hóa/ }).click();
  await expect(page).toHaveURL(/\/phap-ly\/nghi-dinh-284-2026-nd-cp$/);

  await page.goto("/");
  const faq = page.getByRole("region", { name: "Câu hỏi thường gặp" });
  const q = faq.getByText("Giá trên trang lấy từ đâu?");
  await q.click();
  await expect(faq.getByText(/trung vị giá khớp gần nhất/)).toBeVisible();
});
