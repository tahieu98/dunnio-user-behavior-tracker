# Order 2: hợp đồng dữ liệu Clarity và phạm vi toàn website

Cập nhật ngày 07/10/2026, giờ Việt Nam. Tài liệu này chỉnh lại thiết kế cũ: trang phân tích bao phủ mọi trang công khai, còn trang đích chuyển đổi là một thuộc tính riêng. Không dùng danh sách CTA làm giới hạn danh sách trang.

## Kết quả đọc tài liệu Microsoft và kiểm chứng trực tiếp

- [Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api): Bearer token, `numOfDays=1|2|3`, tối đa ba dimensions, 10 requests/project/ngày, tối đa 1.000 dòng và không có pagination. Không có tham số `startDate`, `endDate`, tháng lịch hoặc API điểm chạm trong hợp đồng này.
- [Heatmaps overview](https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-overview): danh sách popular pages theo bộ lọc; Clarity tổng hợp click theo phần tử, không chỉ theo tọa độ chuột tuyệt đối. Responsive layout và các trạng thái DOM là yếu tố quan trọng.
- [Click maps](https://learn.microsoft.com/en-us/clarity/heatmaps/click-maps): có all/dead/rage/error/first/last click; số click, tỷ lệ, selector, ranks, các ảnh trạng thái khác nhau. Số page views có giới hạn 100.000/heatmap.
- [Compare](https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-compare): hai panel có bộ lọc thời gian, thiết bị, segment riêng; xem tổng views/clicks. Chỉ trong một project; Share/Download không dùng được trong Compare.
- [Change screenshots](https://learn.microsoft.com/en-us/clarity/heatmaps/heatmaps-screenshots): đổi ảnh làm click/area data thay đổi theo phần tử có trong ảnh; scroll data giữ nguyên. Không được gắn cùng tọa độ lên một ảnh bất kỳ rồi gọi đó là heatmap Clarity.
- [Download heatmaps](https://learn.microsoft.com/en-us/clarity/heatmaps/download-heatmaps): xuất CSV và PNG của từng heatmap với bộ lọc đang áp dụng. Xuất riêng từng tháng trước khi đối chiếu trong Dunnio.
- [Retention](https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention): heatmaps 9 tháng, playback thông thường 30 ngày. Dữ liệu hết thời gian lưu không thể khôi phục qua token.
- [Client API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api): `set`, `event`, `identify`, consent và masking phục vụ ghi nhận/phân loại trên website. Đây không phải API đọc dữ liệu lịch sử từ tài khoản.
- [Mã nguồn Microsoft](https://github.com/microsoft/clarity): clarity-js ghi nhận, clarity-decode giải mã payload và clarity-visualize dựng replay. Các package này cần dữ liệu đầu vào đã thu thập; chúng không cấp thêm quyền truy cập dữ liệu Microsoft-hosted qua Export token.

Đã kiểm chứng API trực tiếp HTTP 200 lúc 18:11 ngày 07/10/2026, sau đó truy vấn theo `URL + Device` lúc 18:22. Không phụ thuộc phiên đăng nhập web trong Chrome/Codex. Không ghi token vào tài liệu hoặc gói phát hành.

## Trường thực tế từ project Dunnio

Request: `GET /export-data/api/v1/project-live-insights?numOfDays=2&dimension1=URL&dimension2=Device`.

| Nhóm trả về | Trường dữ liệu được giữ nguyên |
| --- | --- |
| Traffic | Url, Device, totalSessionCount, totalBotSessionCount, distinctUserCount, pagesPerSessionPercentage |
| ScrollDepth | Url, Device, averageScrollDepth |
| EngagementTime | Url, Device, totalTime, activeTime |
| DeadClickCount | Url, Device, subTotal, pagesViews, sessionsCount, sessionsWithMetricPercentage, sessionsWithoutMetricPercentage |
| RageClickCount | cùng cấu trúc metric riêng như trên |
| ErrorClickCount | cùng cấu trúc metric riêng như trên |
| ExcessiveScroll | cùng cấu trúc metric riêng như trên |
| QuickbackClick | cùng cấu trúc metric riêng như trên |
| ScriptErrorCount | cùng cấu trúc metric riêng như trên |

API thực tế có `Device=PC, Mobile, Tablet`; Traffic còn có Other. Giữ giá trị Other trong bảng trường đầy đủ. Không ép Other thành Desktop. Không giả định các metric được liệt kê trong tài liệu, ví dụ Popular Pages/Page Title, luôn có mặt trong mọi response. Adapter giữ mọi trường trả về; giao diện không tạo trường thiếu.

`pagesViews` bên trong nhóm DeadClickCount không được dùng làm tổng page views của URL. `subTotal` của DeadClickCount không phải tổng click của all-click heatmap. Không tính page views bằng nhân `pagesPerSessionPercentage` với số phiên. Không cộng distinct users, sessions hoặc trung bình từ các biến thể URL/cửa sổ chồng lấn.

## Ba nguồn dữ liệu và bộ lọc thời gian

| Nguồn | Khoảng thời gian | Dữ liệu có thể đọc | Phạm vi so sánh |
| --- | --- | --- | --- |
| Clarity Export API | 24/48/72 giờ gần thời điểm gọi | Nhóm metric tổng hợp theo URL/Device và các dimensions hỗ trợ | Hai bản API đã lưu có thời điểm và độ dài rõ ràng. Cảnh báo chồng lấn. Không gọi là tháng lịch |
| Clarity PNG/CSV | Bộ lọc tháng đã chọn trong portal khi xuất | Ảnh heatmap gốc và lượt theo selector nếu CSV có cột hỗ trợ | Hai tháng, cùng URL/thiết bị/bộ lọc. Metadata URL/tháng/thiết bị và tổng views/clicks được người nhập xác nhận |
| Dunnio tracker riêng | Sự kiện đã nhận, phân theo tháng Việt Nam | timestamp, path, device, viewport, layout version, X/Y thật, vùng/key và action xác nhận | Lưới 12 cột × hàng 50 px, số lượt từng ô và delta; so sánh ô chỉ khi geometry cùng cohort |

Ảnh PNG đã có màu heatmap bên trong: không giả vờ điều chỉnh cường độ hoặc suy ra số lượt theo pixel. CSV hỗ trợ cột Selector/CSS selector/Element và Clicks/Click count/Number of clicks (các cách viết tương đương được chuẩn hóa). Định dạng chưa hỗ trợ bị báo lỗi rõ; chưa kiểm chứng parser với bản CSV riêng tải từ portal của tài khoản Dunnio. Không suy ra action/đơn hàng từ CSV.

So sánh API có thể dùng dữ liệu thiếu null và hai archive cùng dimensions. Nếu hai bản cùng ID, delta 0 có nghĩa đang so sánh chính một bản. Nếu thời gian khác độ dài hoặc chồng lấn, cảnh báo luôn hiện. Lịch sử API chỉ là các lần đã lấy dữ liệu khi app chạy; không có dịch vụ nền tự đồng bộ sau khi đóng và không tự backfill tháng cũ.

## Danh mục và ảnh trang

Hợp nhất seed sản phẩm/dịch vụ, sitemap công khai và URL Clarity thành 519 đường dẫn ở lần kiểm tra 18:22, tăng lên 521 sau bản API mới lúc 19:40. Số này là số đường dẫn đã biết, không phải chứng nhận mọi URL còn hoạt động. Nhóm: trang chủ, blog category, blog article, product category, product, service và other. Có thể thêm trang thủ công. Danh sách sản phẩm/dịch vụ gốc vẫn giữ trường category; thuộc tính goal tách riêng.

`www.dunniotailor.com` và `dunniotailor.com` được hợp nhất trong danh mục theo path. Giá trị API theo biến thể URL và Device vẫn giữ riêng để không cộng trùng. Không thu thập query, fragment, giá trị input hoặc route admin/account/checkout/search.

Tracker scope all-public tự đăng ký một path công khai mới khi nhận batch hợp lệ đúng origin/key và consent. Trang bị disable không tự bật lại. Website thật cần snippet được cài chung vào template cùng collector HTTPS; backend Windows chỉ bind loopback, không thể nhận traffic của khách truy cập từ internet.

Ảnh được chụp bằng Edge headless kèm playwright-core trong gói; giữ viewport cố định, tải CSS/font, cuộn các viewport chồng lấn để kích hoạt lazy load, đợi ảnh/geometry ổn định, che input. Tên ảnh gồm hash URL và version; không ghi đè ảnh lịch sử. Kiểm tra width/height PNG khớp DOM để tránh kéo giãn và lệch overlay. Ảnh hiện tại được ghi rõ reference, không coi là DOM tháng cũ. Ảnh nguồn lỗi vẫn có thể được site dành khoảng trống; không xóa khoảng trống để ép tọa độ sai.

## Quyền, lưu trữ và giới hạn còn lại

Token mã hóa DPAPI ngoài gói, gọi API từ server; status configured chỉ xác nhận có cấu hình. Cache theo project/days/dimensions trong 4 giờ; quota đếm mọi yêu cầu upstream, kể cả lỗi. UI hiển thị thời điểm bản đã lưu, không dùng thời điểm đọc cache làm thời điểm lấy mới.

PNG nhập/chụp nằm ở `%LOCALAPPDATA%/DunnioInsights/snapshots`, được giữ qua cập nhật và đóng app. Runtime browser/cache/process được dọn khi tắt; dữ liệu phân tích và PNG cần giữ để so sánh lịch sử. SQL backup không bao gồm PNG, nên lưu thêm thư mục snapshots khi chuyển máy.

Không có API công khai đã xác minh để lấy trực tiếp tọa độ/DOM heatmap Microsoft-hosted cho tháng tùy ý bằng Export token. Chức năng local mới hỗ trợ lưu/đối chiếu bản xuất, nhưng heatmap lịch sử riêng của Dunnio cần bản xuất thật từ portal. Điều khiển Chrome trong phiên này bị công cụ chặn khi xác minh URL; không sao chép cookies hoặc sử dụng endpoint nội bộ để vượt qua giới hạn đó.

## Kiểm thử bản 1.3.1

- 10 kiểm thử unit và một integration MySQL đạt: month UTC+07, schema/PII, grid, attribution, phân quyền, origin www, loại trang, CSV, giữ partitions/trường thiếu, cache riêng theo dimensions, quota và từ chối tham số tháng không được API hỗ trợ.
- 8 kiểm thử browser đạt: đăng nhập/session, vai trò, XSS, nhóm/tìm trang, trường API, chuyển nguồn, điểm X/Y thật, PNG/selector và accessibility desktop/mobile.
- Bản đóng gói chạy trực tiếp với cấu hình của người dùng đã lấy bản URL+Device 24 giờ mới, có 9 nhóm metric; so sánh với bản 48 giờ đã lưu trả 37 trường/dòng cho URL bài suit-color trên Desktop. Cảnh báo chồng lấn/khác độ dài hiện đúng. Chọn cửa sổ 24/48 giờ và pin theo export ID được kiểm chứng, kể cả khi bản 48 giờ cũ hơn.
- Native Windows: bật/tắt, bật lại, mutex chống hai instance, kill controller/crash recovery, backup/DPAPI, đóng dashboard giữa lúc capture đều đạt. Hủy browser chụp trước shutdown, TEMP/TMP ở runtime; chỉ hủy download BITS current-user có toàn bộ file trong đúng runtime session. Dọn profile/cache và dừng cây tiến trình; giữ DB và PNG.
- Chưa có traffic thực của tracker riêng hoặc PNG/CSV lịch sử riêng của Dunnio trong DB. Dữ liệu fixture của QA đã được dọn; không nhập thành traffic người dùng.

Các bằng chứng trong `.local/qa/order2-native-data.json`, `windows-lifecycle.json`, `order2-installed.json` và screenshots được giữ local, không nằm trong ZIP. Bản build thử 1.3.0 có thư mục lồng tạo nhầm; dọn thư mục này bị công cụ duyệt tự động chặn (`blocked by policy`). Bản bàn giao 1.3.1 dùng cây build riêng, đã kiểm tra không chứa thư mục lồng đó.
