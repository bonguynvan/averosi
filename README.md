# Averosi

**Dữ liệu Web3 công khai cho người Việt: miễn phí, mã nguồn mở, chỉ đọc.**

Averosi ([averosi.com](https://averosi.com)) là công cụ xem dữ liệu blockchain công khai, kiểm tra rủi ro ví/hợp đồng, theo dõi pháp lý tài sản mã hóa Việt Nam và ước tính thuế 0,1%.

> ⚠ Averosi **không phải** sàn giao dịch hay tổ chức cung cấp dịch vụ tài sản mã hóa. Dự án không được cấp phép theo Nghị quyết 05/2025/NQ-CP, không lưu ký, không môi giới, không quảng bá tài sản hay nền tảng nào, và không đưa ra lời khuyên đầu tư. Xem [Tuyên bố miễn trừ trách nhiệm](content/policies/mien-tru-trach-nhiem.md).

## Trạng thái

| Mô-đun | Trạng thái |
|---|---|
| Công cụ thuế 0,1% (`/thue`) | ✅ hoạt động (chạy trên trình duyệt) |
| Chính sách (miễn trừ, điều khoản, quyền riêng tư) | ✅ bản nháp có phiên bản |
| Thị trường, Trung tâm rủi ro, Theo dõi ví, Pháp lý, Kiến thức | 🚧 đang phát triển |

## Phát triển

Yêu cầu Node ≥ 22, pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm check          # lint + typecheck + test + build
pnpm test:e2e       # Playwright (cần: pnpm --filter @averosi/web exec playwright install chromium)
```

## Tài liệu

- [CLAUDE.md](CLAUDE.md): quy tắc làm việc, kiểm tra pháp lý bắt buộc trước mỗi tính năng
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): kiến trúc và phạm vi
- [docs/LEGAL_REGISTER.md](docs/LEGAL_REGISTER.md): văn bản pháp luật áp dụng (rà soát mỗi 30 ngày; CI báo lỗi khi quá hạn)
- [docs/DESIGN.md](docs/DESIGN.md) + [design/tokens.css](design/tokens.css): hệ thống thiết kế

## Đóng góp

Mọi đóng góp phải tuân thủ các nguyên tắc R1–R10 trong [LEGAL_REGISTER](docs/LEGAL_REGISTER.md). Pull request thêm liên kết giới thiệu sàn, nút giao dịch, lời khuyên đầu tư hay thu thập dữ liệu cá nhân sẽ bị từ chối.

## Giấy phép

Mã nguồn: [Apache-2.0](LICENSE). Tên và logo "Averosi" không thuộc phạm vi giấy phép.
