---
title: Quyền chi tiêu token (approval) là gì và vì sao cần thu hồi
summary: Khi dùng ứng dụng phi tập trung, bạn thường cấp cho hợp đồng quyền chi tiêu token. Quyền này tồn tại cho đến khi bạn thu hồi.
updatedAt: 2026-10-01
minutes: 4
tags: [an-toan, lua-dao]
related: [/rui-ro, /vi]
---

## Approval hoạt động thế nào

Với token chuẩn ERC-20 (USDT, USDC…), muốn một hợp đồng (ví dụ ứng dụng hoán đổi) chuyển token thay bạn, ví phải gọi hàm `approve(spender, amount)`. Quyền này:

- được lưu trên blockchain, **không hết hạn** theo thời gian;
- thường là **không giới hạn** số lượng để tiện cho lần sau;
- vẫn còn hiệu lực dù bạn đã rời khỏi trang web.

`Permit` / `Permit2` cho phép cấp quyền chỉ bằng một **chữ ký** (không tốn phí gas), nên dễ bị lừa ký hơn.

## Rủi ro

Nếu hợp đồng được cấp quyền bị tấn công, hoặc vốn là hợp đồng của kẻ lừa đảo, token có thể bị rút bất cứ lúc nào mà bạn không phải ký thêm gì.

## Thói quen an toàn

1. Chỉ cấp **đúng số lượng cần dùng** nếu ví cho phép chỉnh.
2. Từ chối yêu cầu cấp quyền hoặc chữ ký Permit mà bạn không chủ động thực hiện.
3. Định kỳ rà soát và **thu hồi** quyền không còn dùng (đặt lại `approve(spender, 0)`). Thu hồi là một giao dịch tốn phí gas, do chính bạn ký trong ví.
4. Giữ phần lớn tài sản ở ví không dùng để kết nối ứng dụng.

## Kiểm tra hợp đồng trước khi cấp quyền

Dán địa chỉ hợp đồng vào [Trung tâm rủi ro](/rui-ro) để xem có trong danh sách trừng phạt, danh sách lừa đảo công khai, hay là proxy có thể nâng cấp hay không.

---

*Nội dung giáo dục, không phải tư vấn bảo mật chuyên nghiệp.*
