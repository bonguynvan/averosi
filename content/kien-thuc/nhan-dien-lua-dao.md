---
title: Nhận diện các kiểu lừa đảo tài sản mã hóa phổ biến
summary: Đầu độc địa chỉ, lừa ký cấp quyền, airdrop giả, ủy quyền EIP-7702 độc hại, giả danh hỗ trợ, "đầu tư lợi nhuận cao" — dấu hiệu và cách phòng tránh.
updatedAt: 2026-10-01
minutes: 7
tags: [lua-dao, an-toan]
related: [/rui-ro, /vi, /phap-ly/nghi-dinh-284-2026-nd-cp]
---

## Đầu độc địa chỉ (address poisoning)

Kẻ gian gửi một giao dịch giá trị 0 (hoặc token giả) từ một địa chỉ **có đầu và cuối giống** địa chỉ bạn hay giao dịch. Lần sau, nếu bạn sao chép địa chỉ từ lịch sử giao dịch, bạn có thể chuyển nhầm cho chúng.

**Phòng tránh:** luôn lấy địa chỉ từ nguồn gốc (sổ địa chỉ đã lưu, người nhận gửi trực tiếp), đối chiếu toàn bộ chuỗi ký tự.

## Lừa ký cấp quyền (approval / permit phishing)

Trang giả yêu cầu bạn "xác minh ví" hoặc "nhận thưởng", thực chất là chữ ký **cấp quyền chi tiêu token** cho hợp đồng của kẻ gian. Sau đó chúng rút token mà không cần thêm chữ ký nào.

**Phòng tránh:** từ chối mọi yêu cầu cấp quyền mà bạn không chủ động thực hiện. Định kỳ rà soát và thu hồi quyền không còn dùng.

## Ủy quyền mã EIP-7702 độc hại

Từ bản nâng cấp Pectra của Ethereum, một ví thường có thể **ủy quyền mã** cho một hợp đồng. Ví thông minh hợp pháp dùng cơ chế này, nhưng kẻ gian cũng lừa người dùng ký ủy quyền cho hợp đồng rút tiền, khiến mọi tài sản vào ví bị chuyển đi tự động.

**Phòng tránh:** chỉ ủy quyền qua chính ứng dụng ví bạn tin cậy. [Trung tâm rủi ro](/rui-ro) và [Theo dõi ví](/vi) hiển thị nếu một địa chỉ đang có ủy quyền EIP-7702 và trỏ tới hợp đồng nào.

## Airdrop và token giả

Token lạ xuất hiện trong ví kèm tên miền "nhận thưởng". Chỉ cần tương tác với trang đó là bạn bị yêu cầu ký cấp quyền.

**Phòng tránh:** bỏ qua token lạ, không truy cập liên kết trong tên token.

## Giả danh hỗ trợ / người quen

Tài khoản mạng xã hội giả danh "hỗ trợ kỹ thuật", sàn giao dịch, hoặc người quen bị chiếm tài khoản, xin cụm từ khôi phục, mã OTP hoặc nhờ chuyển tiền.

**Phòng tránh:** không tổ chức hợp pháp nào hỏi cụm từ khôi phục. Xác minh qua kênh khác trước khi chuyển tiền.

## "Đầu tư lợi nhuận cao", sàn và ứng dụng giả

Lời mời góp vốn cam kết lợi nhuận cố định, "nhóm kéo", ứng dụng giao dịch không rõ nguồn gốc cho phép nạp nhưng không cho rút.

**Lưu ý pháp lý:** theo Nghị quyết 05/2025/NQ-CP, nhà đầu tư trong nước chỉ được giao dịch tài sản mã hóa qua tổ chức được Bộ Tài chính cấp phép. Từ 01/09/2026, giao dịch ngoài tổ chức được cấp phép có thể bị phạt 30–50 triệu đồng ([Nghị định 284/2026/NĐ-CP](/phap-ly/nghi-dinh-284-2026-nd-cp)). Xem tình trạng cấp phép mới nhất ở trang Pháp lý.

## Khi đã bị lừa

1. Ngừng tương tác với trang/kẻ lừa đảo; không trả thêm "phí rút tiền".
2. Chuyển tài sản còn lại sang ví mới (cụm từ khôi phục mới).
3. Thu hồi các quyền đã cấp từ ví cũ.
4. Lưu bằng chứng (mã giao dịch, tin nhắn) và trình báo cơ quan công an.

---

*Nội dung giáo dục, không phải tư vấn pháp lý.*
