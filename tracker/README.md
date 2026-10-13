# Cài Dunnio measured behavior tracker

Script chuẩn: `behavior-tracker.js`. `clarity-tracker.js` là bản tương thích cùng mã, đã thay thế tracker cũ.

Đọc [hướng dẫn v1.1](../planning-docs/08-TRIEN-KHAI-HEATMAP-THEO-THANG.md#7-cài-tracker-trên-dunnio) và dùng đoạn cài đặt trong dashboard.

- window.TRACKER_CONFIG được đọc trước khi khởi tạo; consent mặc định false.
- Bắt đầu bằng `dunnioTracker.setConsent(true)` sau consent analytics từ CMP.
- Origin, siteKey, allowedPaths và goalPaths phải khớp registry backend.
- Script chỉ gửi path không có query/fragment và identifier được gắn bởi Dev; không gửi text, input, userAgent hoặc DOM.
- Sử dụng data-track-private để loại trừ vùng nhạy cảm. Input/textarea/select/contenteditable và admin bar được loại trừ sẵn.
- `getLastClickId()` dùng để liên kết callback thành công với click. `trackAction('form_success', clickId)` / `trackAction('customizer_start', clickId)` chỉ gọi khi nghiệp vụ thực sự báo success.
- Lượt bấm link chỉ là click. Navigation chỉ được xác nhận ở trang mục tiêu, cùng tab/same-origin và trong 30 phút.
- Retry giữ nguyên UUID, DB không đếm trùng. Queue nằm trong memory, tối đa 100 event; sendBeacon là best effort khi rời trang. Không đảm bảo mọi event được nhận nếu mất mạng hoặc đóng tab đột ngột.
- DNT/GPC ngăn thu thập. Thu hồi consent xóa queue/session attribution cục bộ.
- Tăng layoutVersion khi sửa nội dung/bố cục; chụp ảnh đúng viewport để phân tích.

Không trỏ website production tới localhost; publish backend và script bằng HTTPS. Không đưa JWT tài khoản dashboard hoặc Clarity API token vào config công khai.
