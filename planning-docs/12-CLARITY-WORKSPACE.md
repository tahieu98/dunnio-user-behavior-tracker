# Clarity Workspace 1.4.0

Luồng mặc định thay bằng thu thập bản xuất Clarity và báo cáo nhiều kỳ. Tracker/API cũ được giữ ở màn hình riêng. Không tạo dữ liệu giả thành dữ liệu Clarity, không lưu từng sự kiện riêng để phục vụ luồng này.

## Thu thập

1. Đăng nhập Dunnio, chọn website, Project ID, thiết bị, loại click/tap, múi giờ và mô tả đầy đủ segment/bộ lọc bổ sung. Xác nhận múi giờ đúng trên portal; nhãn này do người nhập khai báo.
2. Chọn 1–50 URL và 1–12 khoảng ngày, tạo đợt. Mỗi URL × khoảng có mục pending/reading/imported/failed/skipped. Đợt, bộ lọc và tiến độ được lưu trong MySQL qua các lần đóng app.
3. Mở mục để xem hướng dẫn; mở project Clarity trong Chrome đã đăng nhập. Người dùng hoặc trợ lý thực hiện chọn URL **is exactly**, khoảng ngày, thiết bị, loại tương tác và segment. Không giả định liên kết tự áp dụng các bộ lọc.
4. Xuất CSV/PNG riêng ngoài Compare, ghi page views và clicks nếu có. Chọn Nhập file trên đúng mục. Server kiểm tra metadata khớp hàng đợi trước khi đánh dấu imported. Nếu không lấy được dữ liệu, đánh dấu failed và không thay bằng số 0.
5. Nút Hướng dẫn cho trợ lý xuất JSON gồm danh sách mục, URL, bộ lọc, khoảng ngày và hướng dẫn thao tác. File không chứa API token hay cookies. Đây là kế hoạch thực hiện, không phải bằng chứng đã thu thập.

Ứng dụng chưa tích hợp công cụ điều khiển Chrome hay lịch tự chạy. Việc đọc portal cần quyền tài khoản và công cụ thao tác trình duyệt hoạt động. Không dùng Export token để giả lập dữ liệu lịch sử. Mã triển khai không gọi endpoint nội bộ Clarity.

## Kho bản xuất

CSV tối đa 1 MB, PNG tối đa 10 MB; có thể nhập một trong hai. CSV nhận cột Selector/CSS selector/Element cùng Clicks/Click count/Number of clicks/Taps. Giữ CSV nguyên bản nếu chưa nhận diện được hoặc selector trùng; không cộng dòng trùng khi chưa biết phạm vi của chúng. Chưa xác minh parser với CSV xuất thật của tài khoản Dunnio.

Bản xuất giữ URL, project, thiết bị, loại heatmap, segment, ngày đầu/cuối, múi giờ, page views/clicks (có thể null), file gốc, kích thước PNG và thời điểm nhập. Ngày cuối là ngày bao gồm trong bộ lọc, không phải cửa sổ 24–72 giờ API. Hash gồm nội dung và metadata: nhập lại cùng bản trả cùng ID, không làm mất điểm neo đã xác nhận; file giống nhưng kỳ khác là bản riêng.

CSV và số lượt không bắt buộc có PNG. PNG được lưu theo hash, dùng chung file nếu ảnh giống nhau. File PNG nằm trong thư mục snapshots, ngoài database. Sao lưu phải gồm SQL và snapshots; backup SQL riêng không chứa ảnh.

## Đối chiếu

Chọn 2–12 bản của cùng URL/site/project/device/type/segment/timezone. Thứ tự báo cáo theo ngày. Ghép bằng selector nguyên bản; khóa ghép do người phân tích xác nhận được dùng khi selector đổi. Không ghép bằng thứ hạng hoặc tọa độ gần nhau. Hai selector cùng khóa trong một bản bị từ chối.

Delta là B − A; phần trăm là `(B − A) / A × 100`. A=0, B>0 được ghi phát sinh từ 0, không tính %. Thiếu bản/phần tử giữ null. Chỉ khi CSV đọc được và người nhập xác nhận đầy đủ, phần tử vắng mặt mới được tính 0. Page views thiếu/0 không tạo tỷ lệ.

Có thể chọn hai nhóm gồm các bản khác nhau, ví dụ tháng 5+6 và tháng 7+8. Server từ chối khoảng chồng lấn trong hoặc giữa nhóm. Tổng lượt chỉ có khi mọi giá trị có dữ liệu; tỷ lệ nhóm tính từ tổng lượt/tổng page views, không trung bình các tỷ lệ tháng. Không cộng unique users hoặc sessions.

Ảnh A/B lấy đúng bản được chọn. PNG giữ thang màu gốc, không áp cùng thang màu bằng suy luận pixel. Lưới tọa độ theo kích thước ảnh, giữ tỷ lệ khi zoom. Người phân tích chọn phần tử, đánh dấu hoặc nhập X/Y, xác nhận và lưu điểm neo. Số trên bubble là số lượt **của phần tử**, vị trí bubble là điểm neo xác nhận; không phải tọa độ click thực. Khi không có PNG hoặc selector không có trong bản, không đánh dấu.

## API

Các endpoint dưới `/api/clarity-workspace` yêu cầu JWT Dunnio:

- `GET /catalog`, `GET /reports?siteId=&path=&device=`, `GET /reports/:id` (gồm CSV gốc).
- `POST /reports`: metadata, `csv`/`png`, totals, `confirmed`, `completeExport`, tùy chọn `jobId`.
- `PATCH /reports/:id/anchors`: danh sách `{key,x,y,label,matchKey}`, `confirmed:true`.
- `POST /compare`: `{reportIds:[...],groups:{a:[...],b:[...]}}`; groups tùy chọn.
- `GET/POST /runs`, `GET /runs/:id`, `PATCH /jobs/:id`.

Admin/dev được nhập và cập nhật; editor được đọc, so sánh, xuất báo cáo. Backend kiểm tra vai trò độc lập với giao diện. Giới hạn payload lớn chỉ áp dụng cho endpoint nhập sau xác thực.

## Nâng cấp

Migration 010 bổ sung ba bảng, nhập kho PNG/CSV tháng cũ vào workspace với source legacy-archive và project chưa xác định. Không sửa/xóa kho cũ, sự kiện, token hoặc users. Các bản legacy chỉ so sánh với bản có metadata tương thích; không coi project chưa biết là project hiện tại.

Desktop tự chạy migration khi mở. Mã nguồn cần chạy migrate trước khi start. V1.4.0 mở analysis.html mới; tracker-analysis.html giữ màn hình cũ. Các file phát hành không chứa database, token, CSV/PNG người dùng hoặc fixture QA.
