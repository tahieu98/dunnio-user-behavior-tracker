# Dunnio Insights 1.5.0 · macOS Development Package

Thư mục bàn giao gồm bộ cài và toàn bộ source code dùng để tiếp tục phát triển.

## Chọn bộ cài

- `DunnioInsights-1.5.0-macos-arm64.dmg`: Apple Silicon (M1/M2/M3/M4…).
- `DunnioInsights-1.5.0-macos-x64.dmg`: Mac Intel.
- `SHA256SUMS-*.txt`: checksum của artifact chính thức.

## Source code

- `source-code/`: cây source đã xuất từ Git commit ghi trong `SOURCE-MANIFEST.json`.
- `DunnioInsights-1.5.0-macos-source.zip`: cùng source ở dạng ZIP.
- `SOURCE-SHA256.txt`: checksum ZIP source.
- `SOURCE-MANIFEST.json`: commit, repository, thời điểm xuất, số file và danh sách exclusions.

Mở [source-code/desktop/macos/TECHNICAL-ARCHITECTURE.md](source-code/desktop/macos/TECHNICAL-ARCHITECTURE.md) để đọc kiến trúc và quy trình phát triển. Hướng dẫn sử dụng nằm tại [source-code/desktop/macos/USER-GUIDE.md](source-code/desktop/macos/USER-GUIDE.md).

Source package không chứa `.git`, `node_modules`, `.local`, `dist`, `.env` thật, token Clarity, database, snapshots người dùng, cache, backup hay signing credentials. Chạy `npm ci` theo các lockfile để tái tạo dependencies. Lịch sử commit và cập nhật mới nhất nằm tại https://github.com/tahieu98/dunnio-user-behavior-tracker.

