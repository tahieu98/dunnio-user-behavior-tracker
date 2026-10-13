# Order 3 — ứng dụng heatmap tự thu thập

Ngày: 2026-10-11. Yêu cầu: triển khai trong Dunnio Behavior Tracker; 20–50 URL, điểm chạm và số lượt, lưới, khoảng ngày tùy chọn, nhiều kỳ và nhóm kỳ, lưu local trước, đề xuất VPS sau kiểm thử tải local. Không có VPS/domain/đích cloud được cung cấp. Các kỳ tháng 5–8/2026 là ví dụ; không tạo dữ liệu lịch sử thật khi chưa có tracker.

## Quyết định kiến trúc

Tái sử dụng Express/mysql2, authentication, tracking_sites, tracked_pages, page_snapshots, cơ chế chụp snapshot và bản Windows hiện có. Module mới có endpoint và tracker độc lập; dữ liệu Clarity và dữ liệu tracker cũ được giữ. Màn hình mới là `/touch.html`, trở thành màn hình mặc định sau kiểm thử. Không reset dự án. Workspace không có Git; không thể tạo worktree/commit. Order 3 đã yêu cầu lập kế hoạch đến thực thi và sử dụng sub-agents; tiến hành các tác vụ local đã được ủy quyền, không mua VPS hay publish.

Ba phương án đã đối chiếu: giữ raw event (đơn giản nhưng dung lượng tăng theo từng tương tác); tổng hợp click theo ngày/ô/phần tử (chọn); queue và kho phân tích phân tán (chỉ dùng khi benchmark chứng minh MySQL không đủ). Không thêm Redis/Kafka/ClickHouse ở quy mô ban đầu.

## Hợp đồng collector v1

POST `/api/tracker/touch` nhận JSON tối đa 64 KiB:

```json
{"schemaVersion":1,"siteKey":"public-key","batchId":"uuid","consent":true,"sampleRate":1,"context":{"pagePath":"/blog/example.html","layoutVersion":"release-1","device":"mobile","viewportWidth":390,"viewportHeight":844,"documentHeight":5000},"entries":[{"type":"pageview","timestamp":1791700000000,"count":1},{"type":"tap","timestamp":1791700000010,"count":3,"x":180,"y":950,"elementKey":"guide-image","region":"article","anchorQuality":"explicit","elementU":0.45,"elementV":0.35,"elementRect":{"x":40,"y":800,"width":300,"height":500},"fixed":false,"pointerType":"touch"}]}
```

- Entries tối đa 100; count là integer 1–10000; chỉ pageview/tap. timestamp trong 24 giờ, lệch tương lai tối đa 5 phút. Không nhận dữ liệu tháng cũ qua collector production.
- x/y là document CSS pixels; fixed dùng tọa độ viewport và phải được tách khỏi document. Horizontal scroll không được âm thầm xem là viewport width.
- elementU/V 0..1, rect hợp lệ; explicit `data-track-key`/region theo regex hiện có. Fallback structural hash không thu text, href query hoặc DOM id và được ghi `anchorQuality=structural`. Không khẳng định structural key là cùng nội dung qua các bản layout.
- Consent bắt buộc; chặn form/input/contenteditable/private routes; DNT/GPC được tôn trọng. Thu mouse click và touch một lần qua pointerup; không đếm click tổng hợp trùng, không đếm kéo tay/scroll thành tap.
- Browser gom count theo cùng ô không gian + phần tử + ngày + pointerType; giữ batchId khi retry. Flush chỉ bỏ dữ liệu sau ACK HTTP thành công; sendBeacon không phải ACK. Queue có trần và thể hiện số dữ liệu bị bỏ trong getState. Không lưu danh tính/IP/text vào số liệu.
- Dedupe batch receipts theo site + UUID và SHA-256 canonical payload; cùng ID khác payload phải 409. Receipt và counter được ghi cùng transaction. Receipt giữ tối thiểu 72h, vượt window nhận lại phải bị từ chối.

## Lưu trữ

Migration 011 tạo `touch_batches`, `touch_daily_pages`, `touch_daily_points`, `touch_daily_elements`. Tổng hợp ngay trong transaction; không giữ một raw row cho mỗi tap. Point buckets 20px; grid báo cáo 12 cột, hàng 50px. Ghi ngày theo UTC+07, version, viewport chính xác, chiều cao tài liệu và fixed plane; điểm phủ snapshot chỉ khi geometry khớp. Counts dùng BIGINT và giới hạn precision JSON. Không cung cấp unique users khi chưa có cơ chế dedupe riêng.

Phần tử: giữ elementKey, region, anchorQuality và min/max bounds để giải thích di chuyển; relative element bins 0..19. So sánh vị trí chỉ cho cùng version/viewport/geometry; khác layout so sánh tổng cùng explicit key và báo độ tin cậy. Region unmarked không tự coi là phần tử.

## API dashboard

- GET `/api/touch/catalog` (auth): `{sites,pages,layouts,snapshots}`. sites có id/name/origin/public_key; pages có site_id/page_path/title; layouts có site_id/page_path/device/layout_version/viewport_width/document_height/first_seen/last_seen.
- POST `/api/touch/report` (auth), body `{siteId,path,device,version,width,periods:[{id,label,start,end,group:"A"|"B"}]}`. 1–12 kỳ; ngày ISO calendar thật, mỗi kỳ <=366 ngày, tổng không chồng lấn. Cần cả nhóm A/B để có grouped comparison.
- Response `{source:"first-party-aggregated",timezone:"Asia/Ho_Chi_Minh",periods:[{id,label,start,end,group,summary:{pageviews,taps,tapsPer100Views},hasData,points:[{x,y,count,col,row,elementKey,region,anchorQuality,fixed,documentHeight,pointerType}],cells:[{col,row,count}],elements:[{elementKey,count,anchorQuality,region,centroidX,centroidY}],geometry:{minHeight,maxHeight},snapshot}],comparison:{cells:[{col,row,a,b,delta,percent,rateA,rateB}],elements:[{elementKey,a,b,delta,percent,positionA,positionB,positionComparable}],summary:{a,b,delta,percent},geometryComparable,warnings},truncated:false}`.
- Delta luôn B−A; phần trăm baseline A=0 là null/"mới", không Infinity. Không có dữ liệu là thiếu, không tự biến thành zero; các kỳ có pageview nhưng không tap là zero thật. Không so sánh ô lệch version/width/height, không sum phần trăm.
- Catalog API, snippet public endpoint và UI fields theo contract này là nguồn chung cho các nhiệm vụ. Endpoint sites và snapshot hiện có được tái sử dụng. Kỳ đóng theo `[start 00:00+07, end+1 00:00+07)`.

## UI

Vietnamese, không CDN. Bộ lọc site/page/device/version/width; thêm/xóa tối đa 12 kỳ, gán A/B; heatmap + grid toggle, số counts tooltip và bảng điểm; nhiều kỳ thành small multiples, nhóm A/B và bảng delta. Màu dùng chung scale, tăng/giảm có text/số. Empty/loading/error rõ, keyboard và mobile không overflow. Snippet consent mặc định false. Có demo tách rõ dữ liệu giả, không đưa fixture vào dữ liệu thật.

## Archive và hosting

File ngày gzip JSON + manifest SHA-256; bao gồm counts/pages/elements và metadata snapshot/ảnh cần để offline. Export atomic, tải/import vào database khác và report offline không cần cloud. Idempotent restore; cùng archive ID khác nội dung phải từ chối. Restore không cộng lần nữa số đã có. Google Drive/GitHub chỉ là đích backup tùy chọn; local là đích đã chọn. Không lưu token, IP, session hoặc auth vào archive. Chỉ export aggregates, cloud credentials ngoài webroot.

VPS đề xuất khởi điểm 2 vCPU/4 GiB RAM/40 GiB SSD, Ubuntu LTS, Node LTS + MySQL + HTTPS reverse proxy, một replica app. Đây là cấu hình ứng viên, không phải năng lực đã đo trên VPS. Benchmark local ghi hardware/runtime, concurrency, batch size, RPS, taps/sec, latency p50/p95/p99, HTTP errors, CPU/RAM, dung lượng DB và counts sau retry. Không có Docker/VPS hiện tại: ghi rõ những gì chưa chạy. Shared PHP hosting không phù hợp khi không có Node process và scheduled jobs. Backup local 02:15 UTC+07, ngày hôm trước, giữ file; smoke restore và hash check bắt buộc.

## Kiểm chứng và tiêu chí nhận

1. Browser mouse/touch/scroll/fixed/privacy/consent/retry; server ACK và counters khớp, không double tap.
2. MySQL HTTP integration: concurrent duplicate, payload conflict, rollback, registered origins/pages, 24h timestamp, date boundaries/leap day, A/B grouped totals, missing vs zero, geometry mismatch.
3. Archive export→fresh DB restore→same report→second restore không cộng; thiếu file/hash sai bị từ chối.
4. UI fixture + measured integration: 4 kỳ, nhóm May/June và July/August, points/grid/counts, CSV/JSON export, keyboard/axe, desktop/mobile screenshot.
5. Local benchmark và deployment configs; thực chạy cloud là bước yêu cầu VPS/đích backup từ user, không giả định đã deploy.

## Verified refinements

Height-only geometry changes do not create another pageview; path/viewport-width changes create view segments. Each period can override version/width. Archive includes snapshots only for contexts used in that day, counts serialize as decimal strings, and validates hashes/grid/cross-table totals before restoring. Daily job exports the two previous closed dates and expires receipts after72h. /touch.html is now the default after login; source and Windows launcher are1.5.0.
