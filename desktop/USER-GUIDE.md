# Dunnio Insights Desktop · Windows x64 · 1.5.0

## Dunnio Touch — màn hình chính mới

Sau khi mở app, màn hình Điểm chạm hiển thị dữ liệu SDK riêng, heatmap/lưới, số lượt theo ngày và so sánh 1–12 kỳ hoặc nhóm nhiều tháng. Trong Cài đặt thu thập, đăng ký origin/page rồi lấy snippet. Cần collector HTTPS chạy liên tục để thu khách truy cập website; bản Desktop chỉ bind loopback để phân tích local. Chưa gắn tracker lên website production.

Gắn data-track-key ổn định để đối chiếu phần tử. Chọn đúng layout/device/chiều rộng; ảnh không khớp sẽ dùng lưới độc lập. Demo có nhãn DỮ LIỆU GIẢ. Dữ liệu lịch sử Clarity không tự chuyển thành tọa độ mới. Lưu/khôi phục archive và cấu hình máy chủ xem tài liệu `docs/15-ORDER3-OPERATIONS.md` trong gói; SDK có hướng dẫn tại `app/tracker/TOUCH-README.md`.

Archive ngày là aggregates + ảnh, chưa gồm tài khoản/Clarity/config. Gói có CLI `app/backend/scripts/touch-archive.js`; lịch nightly đặt trên collector VPS theo hướng dẫn. Không tự cài lịch chạy nền trên Windows.

## Phân tích từ bản xuất Clarity

Màn hình mặc định mới dùng CSV/PNG xuất từ portal Clarity; không cần cài tracker trên website hoặc có API token. Project ID được nhập trong màn hình phân tích. Phần cấu hình token ở cửa sổ điều khiển phục vụ các chức năng API cũ.

1. Chọn website, Project ID, thiết bị, loại tương tác, múi giờ và bộ lọc/segment. Chọn URL và các khoảng ngày, tạo hàng đợi.
2. Mở từng mục, áp dụng bộ lọc trên Clarity trong Chrome đã đăng nhập, xuất CSV/PNG riêng ngoài Compare. Có thể tải hướng dẫn JSON cho trợ lý. Ứng dụng giữ tiến độ nhưng chưa tự điều khiển Chrome.
3. Nhập CSV, PNG hoặc cả hai cho đúng mục. Chỉ xác nhận CSV đầy đủ khi đã kiểm tra danh sách xuất bao phủ bộ lọc. CSV lạ vẫn được giữ để đọc lại; dữ liệu thiếu không tự chuyển thành 0.
4. Chọn 2–12 bản cùng URL/bộ lọc để so sánh từng kỳ, hoặc chọn các bản vào nhóm A/B để xem tổng nhiều tháng. Các khoảng chồng lấn không được cộng. Có số lượt, tăng/giảm %, lượt/100 page views và xuất báo cáo CSV.
5. Chọn phần tử, đánh dấu vị trí trên PNG hoặc nhập X/Y, xác nhận và lưu điểm neo. Bubble hiển thị lượt của phần tử tại vị trí do người phân tích xác nhận; không phải tọa độ click thực. Có thể đặt khóa ghép xác nhận khi selector thay đổi.

Kho heatmap tháng cũ được giữ và chuyển metadata sang kho mới khi nâng cấp; các bản này chưa có Project ID xác định. Màn hình Tracker cũ vẫn có liên kết riêng. Sao lưu cần giữ cả database và snapshots chứa ảnh.

## Mở và tắt

1. Giải nén toàn bộ ZIP, giữ `DunnioInsights.exe`, `app/` và `runtime/` trong cùng thư mục.
2. Mở `DunnioInsights.exe`. Cửa sổ điều khiển bật kho dữ liệu/backend riêng và mở Dashboard với quyền Admin.
3. Chọn **Tắt ứng dụng** hoặc đóng cửa sổ điều khiển để dừng và thoát hoàn toàn. Đóng Dashboard cũng tự dừng dịch vụ và thoát cửa sổ điều khiển; bắt đầu dừng sau khoảng 4 giây và chờ hoàn tất dọn phiên.
4. Mở lại shortcut **Dunnio Insights** khi cần dùng tiếp; không phải chạy npm, Node hoặc MySQL bằng tay. Mở shortcut khi ứng dụng đang chạy sẽ đưa bạn về phiên hiện có, không hiện lỗi hoặc tạo kho dữ liệu thứ hai.

Lệnh tùy chọn để tắt toàn bộ phiên đang chạy: `DunnioInsights.exe --stop`. Lệnh dùng IPC theo tài khoản Windows và workspace; không kill tiến trình trình duyệt/DB khác.

**Cài shortcut:** mở `Install.vbs`, hoặc chạy `DunnioInsights.exe --install`. Bản cài nằm ở `%LOCALAPPDATA%/Programs/DunnioInsights`; shortcut được tạo trên Desktop và Start Menu. Không có Windows service, auto-start, lịch chạy nền hoặc thay đổi PATH/firewall được tạo.

Windows 10/11 x64, Microsoft .NET Framework 4.8 và Microsoft Edge cần có trên máy. Node và MySQL được kèm trong gói. Nếu máy thiếu Microsoft C++ Runtime phù hợp, lần mở đầu gọi bộ cài Microsoft đã ký số được kèm trong gói; người dùng hoàn tất cửa sổ UAC của Windows. Không cài lại khi runtime đã phù hợp. Quyền **Admin của Dunnio Insights** có đủ chức năng quản trị ứng dụng. Nếu cần quyền hệ điều hành, dùng **Run as administrator** của Windows; không cần nâng quyền để sử dụng thường ngày.

## Dữ liệu nào được giữ lại

Dữ liệu cần thiết nằm tại `%LOCALAPPDATA%/DunnioInsights`:

- `settings.protected`: cấu hình, Clarity token và mật khẩu DB được mã hóa Windows DPAPI theo tài khoản Windows hiện tại.
- `data/mysql/`: database bền vững, gồm số liệu, tài khoản và đề xuất.
- `backups/`: file `.sql.gz` chỉ tạo khi bạn chủ động chọn **Sao lưu dữ liệu**.
- `snapshots/`: PNG heatmap Clarity đã nhập và ảnh tham chiếu hiện tại, được giữ để so sánh lịch sử.
- `lifecycle.jsonl` (tối đa khoảng 16 KB) và `last-backend-error.json`: chẩn đoán bật/tắt và lỗi gần nhất. Không lưu token, dữ liệu request hay nội dung lỗi có credentials; không tăng dần qua các phiên.

Ở thiết bị đã cấu hình bản local trước đó, lần mở đầu tiên tự lấy cấu hình từ `%USERPROFILE%/.codex/local-services/dunnio-review/tracker.env` và chuyển database đang chạy sang database riêng của Desktop. Database nguồn vẫn được giữ để phục hồi/đối chiếu; không bị xóa. Thiết bị mới dùng **Cấu hình Clarity** để nhập Project ID/token. ZIP không chứa token hoặc dữ liệu người dùng.

DPAPI gắn với tài khoản Windows: sao chép riêng `settings.protected` sang người dùng/máy khác sẽ không giải mã được. Cần cấu hình token lại trên thiết bị đó. Windows owner mở ứng dụng có toàn quyền Admin trong workspace local; không dùng profile Windows chung với người không được phép quản trị.

## Những gì được dọn khi đóng

- Đóng các cửa sổ trình duyệt thuộc phiên Dunnio, không đóng Edge/Chrome thông thường của bạn.
- Dừng nhận request, đóng kết nối MySQL, shutdown MySQL sạch, sau đó giải phóng cây tiến trình bằng Windows Job Object.
- Xóa profile trình duyệt, cookies, session/localStorage, cache, dump chuyển dữ liệu và log tạm dưới `runtime/<session>/`.
- Hủy phiên chụp ảnh đang chạy; các profile headless và TEMP/TMP nằm trong runtime riêng. Nếu Edge tạo download BITS trong runtime, chỉ hủy download của người dùng hiện tại có toàn bộ file trong đúng phiên đó trước khi dọn cache. Không thay đổi cấu hình cập nhật Edge/Windows toàn hệ thống.
- Tắt hoặc đóng Dashboard cũng thoát cửa sổ điều khiển và giải phóng khóa phiên. Shortcut mở lại được sau khi dừng hoàn tất. Nếu backend gặp lỗi và cửa sổ điều khiển vẫn còn để báo trạng thái, mở shortcut sẽ thử bật lại phiên đó.

Windows Job Object kết thúc các tiến trình con khi launcher chết bất thường. Khi mất điện/kill/crash, cache tạm có thể còn trên đĩa; lần mở tiếp theo dọn nó và MySQL thực hiện crash recovery. Không thể dọn file sau mất điện khi ứng dụng không còn chạy. Windows có thể giữ filesystem cache theo chính sách hệ điều hành; đây không phải tiến trình Dunnio bị bỏ lại.

Launcher kiểm tra cửa sổ Edge thuộc phiên để xác định Dashboard còn mở, không suy ra từ số helper hoặc một PID Edge. Nếu backend/MySQL hoặc Edge thoát với mã lỗi, launcher giữ trạng thái lỗi để có thể bật lại; nhật ký ghi lý do/mã thoát thay vì đóng im lặng.

## Sao lưu và cập nhật

Chọn **Sao lưu dữ liệu** khi app đang bật. File `.sql.gz` là logical database backup nhất quán; không chứa plaintext Clarity API token của cấu hình mới. Giữ file backup bạn cần. Khôi phục ở máy mới cần database cùng schema và cấu hình credentials riêng; bản này không tự ghi đè database khi khôi phục.

Backup đang tạo được ghi trong runtime trước, chỉ chuyển sang `backups/` khi hoàn tất. Nếu hủy/đóng trong khi sao lưu, file đang làm dở được dọn cùng phiên; không để lại file `.sql.gz` hoàn thành giả.

Trước cập nhật: sao lưu, tắt ứng dụng, giải nén gói mới vào thư mục binaries hoặc chạy lại Install. Dữ liệu/cấu hình ở LocalAppData được giữ nguyên. Không xóa thư mục dữ liệu để thay phiên bản app.

## Giới hạn kết nối local

Backend và MySQL chỉ bind loopback và dùng port còn trống, không mở cổng internet. API Clarity được truy cập outbound bằng HTTPS. Bản Desktop không biến máy local thành collector cho khách truy cập website ngoài internet; muốn tracking riêng trên website thật cần collector HTTPS được triển khai phù hợp.

Danh sách trang hợp nhất sitemap và URL trong bản export Clarity, có nhóm blog/danh mục/sản phẩm/dịch vụ; trang đích chuyển đổi được đánh dấu riêng. Bấm **Cập nhật sitemap** để đọc các URL mới. Bảng Clarity có thời điểm của cửa sổ 24/48/72 giờ và số liệu theo URL/thiết bị; phần mở rộng hiển thị toàn bộ trường API cùng chức năng đối chiếu hai bản đã lưu. Cache 4 giờ, quota 10 yêu cầu/project/ngày; không cần đăng nhập web để gọi API.

Heatmap của tracker riêng dùng sự kiện tọa độ thực tế đã nhận. Tháng không có dữ liệu hiển thị **— / chưa nhận sự kiện**, không có nghĩa lưu lượng Clarity bằng 0. Trước khi cài snippet cho toàn website, triển khai collector HTTPS; snippet localhost không thu được tương tác từ thiết bị của khách.

Để đối chiếu heatmap tháng cũ: trên Clarity chọn URL, tháng, thiết bị, Click/Tap; xuất PNG và tùy chọn CSV cho từng tháng. Trong Dunnio chọn trang, nhập qua **Cài đặt tracking → Nhập heatmap lịch sử**, xác nhận metadata đúng bộ lọc. Chọn nguồn **Clarity · PNG/CSV đã xuất** và hai tháng. PNG giữ heatpoint/màu gốc; CSV hiển thị lượt theo selector nếu có cột được hỗ trợ. App không suy ra tọa độ hoặc lượt từng ô từ màu ảnh. Lưới trên PNG chỉ giúp xác định vị trí để ghi chú.

**Chụp lại trang hiện tại** tải trang public bằng Edge, giữ đúng viewport/CSS/font và kiểm tra kích thước PNG. Ảnh được lưu theo URL và version; không ghi đè ảnh lịch sử. Cài snippet với cùng layoutVersion của release đó để liên kết các sự kiện tương lai. Ảnh hiện tại không đại diện DOM của tháng cũ. Các ảnh nguồn không tải được có thể giữ khoảng trống của website; app báo số ảnh chưa tải.

SQL backup chỉ lưu database, không gồm PNG. Khi chuyển máy hoặc sao lưu đầy đủ, giữ thêm thư mục `snapshots/`. Clarity giữ heatmap 9 tháng; Export API chỉ trả tổng hợp 1–3 ngày gần nhất và không backfill tháng lịch.

## Gỡ bản portable

Tắt ứng dụng, xóa thư mục đã giải nén/binaries và shortcut nếu đã cài. Dữ liệu bền vững vẫn ở `%LOCALAPPDATA%/DunnioInsights` để tránh mất báo cáo. Chỉ xóa dữ liệu này khi bạn chủ động muốn xóa toàn bộ dữ liệu/cấu hình/sao lưu của mình.

Executable hiện chưa ký Authenticode; bản bàn giao có manifest/hash SHA-256. Không có cơ chế vượt qua SmartScreen/antivirus hay thay đổi thiết lập bảo mật Windows.
