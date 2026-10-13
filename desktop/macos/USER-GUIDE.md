# Dunnio Insights 1.5.0 · macOS

## Cài đặt

macOS 14 trở lên. Chọn `arm64` cho Mac chip Apple Silicon (M1/M2/M3/M4…) hoặc `x64` cho Mac Intel. Tải DMG hoặc ZIP từ [GitHub Releases](https://github.com/tahieu98/dunnio-user-behavior-tracker/releases). Trong DMG kéo Dunnio Insights vào Applications, rồi mở ứng dụng. MySQL, Node trong Electron và Chromium để chụp trang được kèm; không cần cài Homebrew/MySQL/Chrome và không cần sudo.

Đây là bản preview có chữ ký ad-hoc, chưa có Apple Developer ID/notarization. macOS có thể yêu cầu xác nhận qua Finder **Open** hoặc **System Settings → Privacy & Security → Open Anyway** khi bạn tin cậy nguồn tải. Nếu chính sách thiết bị không cho phép, cần bản ký Developer ID; không tắt Gatekeeper hay xóa quarantine bằng script. Không có credentials Apple trong repository.

## Sử dụng và thoát

Mở Dunnio Insights để vào Dunnio Touch với quyền Admin local. Clarity Workspace được giữ trong menu điều hướng web. Menu ứng dụng có Cấu hình Clarity, Sao lưu dữ liệu, Mở thư mục dữ liệu và Tắt ứng dụng (Command+Q).

Đóng cửa sổ cuối cùng hoặc Command+Q dừng backend/MySQL, kết thúc nhóm tiến trình riêng (gồm trình chụp ảnh) và dọn cache phiên. Mở lần hai đưa bạn về cửa sổ hiện tại. Không tự bật lại khi lỗi, không có vòng lặp auto-restart, không tạo service hoặc Login Item. API/DB chỉ bind 127.0.0.1 trên port còn trống.

Nhập Project ID và Export API token qua menu **Cấu hình Clarity**. Cấu hình được mã hóa bằng Electron safeStorage/Keychain, theo tài khoản macOS. Windows DPAPI không thể chuyển trực tiếp sang Keychain; nhập token trên Mac. Keychain cần được mở khóa. Bộ cài không chứa token, tài khoản khách hàng hay database của Windows.

## Dữ liệu bền vững

`~/Library/Application Support/Dunnio Insights/` chứa `settings.keychain`, `data/mysql/`, `snapshots/`, `backups/`, `touch-archives/` và chẩn đoán lỗi gần nhất. Những dữ liệu này được giữ khi thoát hoặc cập nhật. `runtime/<UUID>/` chứa cache/cookies và file tạm; được dọn sau khi dừng dịch vụ. Socket MySQL dùng thư mục tạm riêng, quyền 0700, tên ngắn để phù hợp giới hạn Unix socket của macOS.

Khi force quit launcher, worker nhận IPC disconnect và dọn nhóm tiến trình; sau mất điện/kill cả worker, cleanup chỉ thực hiện được ở lần mở kế tiếp. Không copy trực tiếp thư mục data/mysql giữa Windows và Mac; chuyển bằng SQL backup cùng với snapshots/touch-archives và nhập cấu hình riêng. Backup SQL không chứa Keychain và không kèm PNG.

App macOS dùng cùng migrations 001–013 và các chức năng 1.5.0. Clarity Export API vẫn giới hạn dữ liệu tổng hợp 1–3 ngày; heatmap lịch sử nhập từ bản xuất, tracker riêng cần collector HTTPS để nhận traffic website thật.

## Build và kiểm thử

Trên Mac có Node 24 và npm, từ repository:

```sh
cd desktop/macos
npm ci
npm test
npm run prepare:bundle
npm run build -- --arm64  # hoặc --x64 trên Mac Intel
npm run smoke -- '../../dist/macos/mac-arm64/Dunnio Insights.app/Contents/MacOS/Dunnio Insights'
```

GitHub Actions `macOS packages` chạy hai runner native, kiểm thử backend, launcher, build DMG/ZIP, verify chữ ký và mở/đóng gói app hai lần trước khi publish preview. Smoke dùng database/cấu hình random trong thư mục test tạm, không dùng Keychain/dữ liệu thật và không gọi API Clarity. Chạy build mới trên Windows không chứng minh app hoạt động trên Mac; xem kết quả Actions của commit cụ thể.
