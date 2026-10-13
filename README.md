# Dunnio Insights · v1.5 — Dunnio Touch

## macOS · Apple Silicon và Intel

Launcher macOS nằm ở [`desktop/macos`](desktop/macos/USER-GUIDE.md), dùng chung frontend/backend/migrations với Windows. Gói DMG/ZIP kèm MySQL và Chromium, cấu hình dùng Keychain, đóng cửa sổ/Command+Q dừng dịch vụ và dọn cache phiên. macOS 14+, hai bản `arm64` và `x64`. [Tải bản Mac](https://github.com/tahieu98/dunnio-user-behavior-tracker/releases) · [Build và kiểm thử](https://github.com/tahieu98/dunnio-user-behavior-tracker/actions/workflows/macos.yml). Bản preview ad-hoc signed, chưa notarized; đọc hướng dẫn trước khi cài.

## Cấu trúc dự án

| Thư mục | Vai trò |
| --- | --- |
| `backend/src`, `backend/migrations`, `backend/test` | Express/MySQL, schema và kiểm thử |
| `frontend` | Dunnio Touch, Clarity Workspace, quản trị |
| `tracker` | SDK consent và collector cho website |
| `desktop/launcher` | Launcher Windows với DPAPI/Job Object |
| `desktop/macos` | Electron, Keychain và worker quản lý dịch vụ Mac |
| `deployment` | Docker/VPS collector HTTPS |
| `planning-docs`, `design-system` | Thiết kế, hướng dẫn và quy trình |
| `.github/workflows` | Build/kiểm thử và publish preview macOS |

`dist`, `.local`, dependencies, token, database và kết quả thử được bỏ khỏi Git. Các gói phần mềm được đưa lên Releases sau khi kiểm thử thay vì commit binary vào repository.

Màn hình chính mới `/touch.html` thu thập click/tap trực tiếp từ website có cài SDK, tổng hợp theo ngày và hiển thị heatmap + lưới + số lượt. So sánh 1–12 khoảng ngày, các nhóm nhiều tháng, số lượt/%/lượt chạm trên 100 lượt xem, vị trí phần tử và xuất CSV/JSON. Archive gzip hằng ngày có SHA-256, snapshot và khôi phục local. Không có phí API theo event của PostHog/Clarity; cần collector HTTPS để nhận traffic website thật.

[Thiết kế Order 3](planning-docs/13-ORDER3-DESIGN.md) · [Kế hoạch thực thi](planning-docs/14-ORDER3-IMPLEMENTATION.md) · [Vận hành, kiểm thử, VPS và backup](planning-docs/15-ORDER3-OPERATIONS.md) · [Cài SDK](tracker/TOUCH-README.md).

Bản Windows mới: `dist/DunnioInsights-1.5.0-win-x64/DunnioInsights.exe`. Tài liệu vận hành mô tả số liệu đo local và phần VPS/Docker chưa được chạy thực tế. Demo `touch.html?demo=1` dùng fixture, không phải dữ liệu khách hàng.

## Clarity Workspace · chức năng v1.4 được giữ ở /analysis.html

`frontend/analysis.html` mở luồng thu thập bản xuất từ Clarity, không yêu cầu cài tracker trên website. Chọn tối đa 50 URL × 12 khoảng ngày để tạo hàng đợi có hướng dẫn bộ lọc cho người dùng hoặc trợ lý thao tác trên Chrome. Mở project không tự áp dụng bộ lọc; ứng dụng chưa có bộ tự điều khiển Chrome.

Nhập CSV, PNG hoặc cả hai cho từng mục; có thể chỉ giữ CSV để giảm lưu trữ. CSV gốc được giữ ngay cả khi chưa hỗ trợ định dạng. Báo cáo so sánh 2–12 kỳ, tăng/giảm số lượt và %, lượt/100 page views, hoặc tổng nhóm tháng 5–6 với nhóm tháng 7–8. Các khoảng chồng lấn không được cộng; dữ liệu thiếu không trở thành 0 trừ khi người nhập xác nhận CSV đầy đủ.

Ảnh có lưới 12 cột × hàng 50 px. Điểm neo phần tử do người phân tích xác nhận, đi kèm số lượt của phần tử; không suy ra tọa độ từng click từ PNG. Có thể xác nhận khóa ghép để đối chiếu cùng phần tử khi selector thay đổi. Bộ lọc/project/thiết bị/múi giờ phải tương thích.

Chạy `npm run migrate` trong `backend` trước khi khởi động mã nguồn mới. Migration `010_clarity_workspace.sql` bổ sung bảng và sao chép metadata kho heatmap cũ; giữ nguyên dữ liệu gốc. Màn hình tracker trước đây ở `frontend/tracker-analysis.html`.

[Hướng dẫn thu thập và đối chiếu](planning-docs/12-CLARITY-WORKSPACE.md). Kiểm thử: `npm test`; `npm run test:browser:clarity` (cần MySQL đã migrate và cấu hình môi trường). Các kiểm thử dùng dữ liệu fixture, không gọi tài khoản Clarity.

## Bản ứng dụng Windows mới

Đã có launcher Windows x64, Node/MySQL kèm trong gói, quyền Admin local, DPAPI bảo vệ credentials và tự dọn tiến trình/cache khi đóng. Dùng `dist/DunnioInsights-1.4.0-win-x64/DunnioInsights.exe` hoặc giải nén `dist/DunnioInsights-1.4.0-win-x64.zip`. Có thể mở `Install.vbs` để tạo shortcut Desktop/Start Menu.

[Hướng dẫn Windows](desktop/USER-GUIDE.md) · [Thiết kế đóng gói và kiểm thử](planning-docs/10-DONG-GOI-WINDOWS.md).

Order 2: [hợp đồng dữ liệu Clarity, trường API và so sánh các khoảng thời gian](planning-docs/11-CLARITY-DATA-CONTRACT-VA-PHAM-VI.md). Danh mục toàn website hợp nhất sitemap, URL Clarity và seed; nhóm sản phẩm/dịch vụ, blog category và blog article tách riêng với goal chuyển đổi. Bảng API giữ đủ trường theo URL/Device, hiện cửa sổ dữ liệu thực tế và đối chiếu các bản đã lưu. Có nhập PNG/CSV heatmap tháng từ Clarity để đối chiếu đúng ảnh gốc.

Bản Desktop lưu dữ liệu tại `%LOCALAPPDATA%/DunnioInsights`, credentials được mã hóa theo tài khoản Windows. Khi đóng, xóa profile/cache/log/dump tạm của phiên; database/config/sao lưu do user tạo được giữ. Không phụ thuộc dịch vụ Laragon. Bản review nguồn dưới đây được giữ để đối chiếu/rollback.

Build: `./desktop/build-windows.ps1`; kiểm thử vòng đời native: `./desktop/test-windows.ps1`. ZIP không chứa token hoặc database người dùng. Các file source/licensing và SHA-256 manifest đi cùng gói.

Ứng dụng Express/MySQL giúp Developer và Content Editor phân tích điểm chạm trên website. Màn hình chính: `frontend/touch.html`; Clarity Workspace: `frontend/analysis.html`.

## Xem bản chạy local

- Minh họa tracker cũ: http://localhost:3000/tracker-analysis.html?demo=1
- Dữ liệu tracker mới: http://localhost:3000/touch.html (đăng nhập)
- Clarity Workspace: http://localhost:3000/analysis.html (đăng nhập)
- Tài khoản local đã tạo được lưu tại `%USERPROFILE%/.codex/local-services/dunnio-review/access.txt`. Không có mật khẩu mặc định.
- MySQL review riêng: `127.0.0.1:3307`, database `dunnio_review`. Secrets ở cùng thư mục ngoài webroot.

Sau khi server dừng, chạy `./start-local.ps1` tại thư mục dự án. Script khởi động lại MySQL review nếu port 3307 chưa lắng nghe, rồi chạy Node. Không trỏ instance này vào data Laragon đang dùng.

Demo dùng số liệu giả lập tháng 08–09/2026, ảnh trang được chụp ngày 07/10/2026. Token Clarity thật đã kiểm chứng HTTP 200, nhưng chưa cài tracker riêng lên dunniotailor.com. Kho sự kiện riêng vẫn trống; dữ liệu tổng hợp API được hiển thị riêng và không biến thành tọa độ giả.

## Chức năng

- Heatmap/lưới 12 cột × hàng 50px, phủ snapshot đúng viewport; trang dài không bị ép về hàng 100.
- So sánh tháng theo múi giờ Việt Nam, thiết bị; chọn layoutVersion/chiều rộng riêng cho A và B. Cùng bố cục dùng delta ô; khác bố cục đối chiếu theo tên vùng. Số lượt hoặc trên 100 lượt xem dùng chung thang màu.
- Chi tiết ô, vùng và phần tử được gắn nhãn; phân biệt click intent với navigation/form/customizer success.
- Bảng thay đổi theo vùng, exposure/scroll, mẫu nhỏ và trạng thái không có dữ liệu.
- Ghi đề xuất theo ô và hai tháng; Admin duyệt/đánh dấu triển khai; xuất CSV.
- Đăng ký nhiều website/trang, origin/goal riêng; collector consent-first, idempotent, giới hạn request và không lưu text/input/query.
- Clarity export tổng hợp có cache/quota; không dùng dữ liệu này để tạo tọa độ giả.

Đọc [thiết kế và cách tích hợp chi tiết](planning-docs/08-TRIEN-KHAI-HEATMAP-THEO-THANG.md). Dashboard đời đầu ở `dashboard.html` giữ để tham khảo và quản trị; bảng click/grid của nó không phải nguồn report mới.

## Cài vào môi trường MySQL khác

Cần Node.js tương thích dependencies, MySQL 8.x, npm. Bản review đã chạy MySQL 8.4.3 và Chrome.

1. Tạo database riêng (utf8mb4) và database user được cấp quyền trên database đó.
2. Tạo file env từ `backend/.env.example` ở vị trí ngoài webroot; cấu hình DB_HOST/PORT/NAME/USER/PASSWORD.
3. Đặt JWT_SECRET ngẫu nhiên ≥32 ký tự; INITIAL_ADMIN_PASSWORD duy nhất ≥12 ký tự. Ví dụ tạo secret bằng Node `crypto.randomBytes(32).toString('hex')`.
4. Đặt DOTENV_CONFIG_PATH tới file env rồi chạy các lệnh sau trong `backend`:

```powershell
$env:DOTENV_CONFIG_PATH = 'C:\path-outside-webroot\tracker.env'
npm ci
npm run migrate
npm run admin:create
npm start
```

Không chạy `admin:create` để ghi đè admin có sẵn. Sau khi tạo admin, bỏ INITIAL_ADMIN_PASSWORD khỏi env production. Migration runner không cài tài khoản admin/admin123 từ SQL kế hoạch cũ. Nó lưu schema_migrations và không lặp lại seed đã áp dụng.

Mặc định HOST=127.0.0.1 để chạy sau reverse proxy. Cấu hình domain backend HTTPS công khai, CORS_ORIGIN là origin dashboard, NODE_ENV=production, ENABLE_DEMO=false. Repository `.htaccess` từ chối Apache phục vụ mã nguồn; chỉ dùng Node phục vụ frontend/tracker. Clarity token và project ID được đặt trong env, không lưu qua UI.

## Chụp ảnh phiên bản trang

Đăng ký site và page trước, rồi từ `backend`:

```powershell
npm run capture -- 1 /blog/what-suit-color-to-choose.html dunnio-release-2
```

Script dùng Edge headless mặc định, chụp desktop 1440px và mobile 390px, che input, chặn collector, đợi font/CSS/lazy images và geometry, lưu PNG và metadata. Có thể đặt PLAYWRIGHT_CHANNEL=chrome khi cần. Bản Desktop có nút chụp ngay trong UI, không cần Node/Playwright cài riêng. Tăng layoutVersion trong config tracking tương ứng trước khi thu dữ liệu phiên bản mới. Snapshot không được ghi đè; không gán ảnh hiện tại cho các layout lịch sử chưa biết.

Nếu event geometry khác snapshot, report hiển thị lưới độc lập và cảnh báo thay vì gắn các điểm vào sai nội dung. Tên `data-track-region`/`data-track-key` giúp đối chiếu nội dung ổn định khi vị trí thay đổi.

## Cài tracker

Dùng đoạn script trong phần “Cài đặt tracking” của dashboard, bổ sung tài liệu 11. Dunnio dùng scope all-public cho mọi trang công khai, goalPaths tách riêng để xác nhận chuyển đổi. Site cấu hình scope registered vẫn dùng allowedPaths. Đồng bộ CMP trước khi gọi `dunnioTracker.setConsent(true)`; thu hồi dùng `setConsent(false)`. Gắn key/region không chứa dữ liệu cá nhân. Hook form_success/customizer_start chỉ gọi sau thành công thật.

Các action hiện tại được xác nhận phía trình duyệt trong vòng 30 phút sau click. Chưa có xác nhận đơn hàng/doanh thu từ server. V1 áp dụng full-page, same-tab, same-origin navigation; chưa có SPA/new-tab/cross-domain attribution.

## Kiểm thử và vận hành

```powershell
npm test
# Bật integration MySQL trên database review riêng; cần INITIAL_ADMIN_PASSWORD:
$env:RUN_DB_TESTS = 'true'
npm test
# Backend ở port 3000 phải đang chạy:
npm run test:browser
npm audit --omit=dev
```

Tests gồm monthly UTC+07 boundaries, tọa độ trang dài, sanitizer, idempotency, xác nhận action, phân quyền, nhiều site cùng path, cache/quota Clarity dùng mock upstream, UI/CSV/XSS notes, consent/retry/navigation và axe trên desktop/mobile. Các test DB cleanup dữ liệu do chúng tạo; không dùng database production để chạy kiểm thử.

`npm run retention` xóa measured events cũ hơn EVENT_RETENTION_DAYS (mặc định 400), Clarity exports cũ hơn 90 ngày. Cấu hình scheduler và backup theo môi trường; chưa có job tự động được tạo. Dữ liệu đã xóa không còn đủ để dựng report tháng cũ.

Xem [planning-docs](planning-docs/README.md) cho kế hoạch gốc và các điều chỉnh v1.1.
