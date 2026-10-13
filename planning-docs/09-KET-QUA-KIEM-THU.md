# Kết quả kiểm thử bản local v1.1

Ngày thực hiện: 07/10/2026, múi giờ Việt Nam. Kiểm tra trên mã nguồn hiện tại, MySQL 8.4.3 riêng tại port 3307 và Chrome headless. Backend review chạy ở port 3000.

## Kết quả

| Nhóm | Kết quả | Bằng chứng |
|---|---|---|
| Node unit/integration | 7/7 pass, không skip | `npm test` với RUN_DB_TESTS=true |
| Playwright | 6/6 pass, không skip | `npm run test:browser` |
| Accessibility tự động | Không có violation cho WCAG 2 A/AA tags ở desktop/mobile được kiểm tra | Axe trong test browser demo |
| Dependencies production | 0 vulnerability báo cáo tại thời điểm audit | `npm audit --omit=dev` |
| JavaScript syntax | Pass tất cả JS trong src/scripts/frontend/tracker | `node --check` |
| Hai tên tracker | Mã giống nhau | Compare-Object không có khác biệt |
| Migration | 001–006 áp dụng | schema_migrations trong database review |

Các bài backend xác nhận ranh giới tháng UTC+07, grid trang dài >5.000px, consent/PII sanitizer, action attribution theo thời gian và session, idempotent retry, multi-site cùng `/`, hai revision khác nhau tắt delta ô, Editor không duyệt note, đổi mật khẩu ghi hash đúng, quota/cache/export Clarity và body limit.

Các bài browser xác nhận UI/filters/cell inspector/keyboard/CSV, empty state, hai revision/snapshot độc lập và CSV region, login/logout sessionStorage, note được hiển thị như text và Admin duyệt, legacy template escape HTML/code preview, tracker consent/retry/actual coordinates/privacy/navigation/form callback.

Clarity upstream được mock trong kiểm thử cache/quota; chưa dùng token API thật. Navigation/form được kiểm thử bằng website fixture có kiểm soát; chưa gửi test form hoặc cài script vào website Dunnio production.

Ảnh QA tại `.local/qa/desktop.png` và `.local/qa/mobile.png`. Ảnh tham chiếu của bài Dunnio được lưu tại `frontend/snapshots/`. Snapshot ngày 07/10/2026 và các số liệu minh họa không phải bằng chứng traffic lịch sử tháng 08/09.

## Phạm vi chưa xác minh

- Tải lớn, SLO/P95 và benchmark một triệu sự kiện.
- Core Web Vitals và ảnh hưởng thực tế của script trên website production.
- Browser ngoài Chrome, reader/accessibility thủ công toàn diện.
- Clarity credentials/project thực tế, xác nhận đơn hàng từ server.
- Reverse proxy HTTPS, WAF, backup và scheduler retention trong môi trường production.

Các test DB đã xóa page/site/user/note/events/export fixture do chúng tạo. Database measured review còn trống; demo fixtures được đọc từ module riêng và không ghi vào behavior_events.
