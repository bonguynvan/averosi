---
title: Đọc chỉ báo kỹ thuật — SMA, EMA, RSI, MACD, Bollinger, ATR
summary: Mỗi chỉ báo đo điều gì, được tính thế nào, và vì sao chúng không phải tín hiệu mua bán.
updatedAt: 2026-10-01
minutes: 6
tags: [du-lieu]
related: [/tai-san/btc, /bieu-do]
---

Chỉ báo kỹ thuật là **các phép thống kê trên chuỗi giá quá khứ**. Chúng mô tả dữ liệu đã xảy ra, không dự đoán tương lai. {{BRAND_NAME}} hiển thị giá trị thô trên trang tài sản, tính ở máy chủ từ nến cặp USD pháp định.

## SMA — trung bình cộng đơn giản

Trung bình giá đóng cửa của N nến gần nhất (20, 50, 200). Làm mượt dao động ngắn hạn để thấy xu hướng chung. Càng dài càng chậm phản ứng.

## EMA — trung bình lũy thừa

Giống SMA nhưng nến gần đây có trọng số lớn hơn (hệ số 2/(N+1)), nên phản ứng nhanh hơn với biến động mới.

## RSI 14 — chỉ số sức mạnh tương đối

Thang 0–100, so sánh độ lớn trung bình của các phiên tăng với các phiên giảm trong 14 nến (phương pháp làm mượt của Wilder). Giá trị cao nghĩa là giai đoạn gần đây tăng nhiều hơn giảm. Giá trị đó **không** có nghĩa là giá sắp đảo chiều.

## MACD 12/26/9

- **Đường MACD** = EMA 12 − EMA 26.
- **Đường tín hiệu** = EMA 9 của đường MACD.
- **Histogram** = MACD − tín hiệu.

Đo khoảng cách giữa xu hướng ngắn và dài hạn. Tên "tín hiệu" là thuật ngữ kỹ thuật, không phải khuyến nghị.

## Bollinger 20, 2σ

Dải giữa là SMA 20. Hai dải trên và dưới cách dải giữa 2 lần độ lệch chuẩn. Dải mở rộng khi biến động tăng, thu hẹp khi biến động giảm.

## ATR 14 — biên độ dao động trung bình

Trung bình của "biên độ thực" (lớn nhất trong: cao − thấp, |cao − đóng cửa trước|, |thấp − đóng cửa trước|). Đo mức dao động, không chỉ hướng giá.

## Giới hạn

- Cùng một chỉ báo cho kết quả khác nhau theo khung thời gian và nguồn dữ liệu.
- Thị trường tài sản mã hóa biến động mạnh. Mọi chỉ báo đều trễ so với giá.
- Không chỉ báo nào cho biết giá tương lai.

Thử trên [biểu đồ kỹ thuật](/bieu-do): thêm chỉ báo từ menu Indicators.

---

*Nội dung giáo dục. Không phải tín hiệu mua bán và không phải lời khuyên đầu tư.*
