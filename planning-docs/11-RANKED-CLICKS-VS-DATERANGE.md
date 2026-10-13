# Plan: Hiển thị vị trí + số lượt click (ranked click bubbles) với custom date range

## Context

Người dùng cần tái tạo tính năng "ranked click bubbles" từ Microsoft Clarity UI — hiển thị **số thứ tự vị trí + số lượt click + % tổng lượt** trên heatmap, đồng thời so sánh hai khoảng thời gian bất kỳ do người dùng chọn (hiện chỉ hỗ trợ chọn theo tháng).

Phân tích codebase thực tế cho thấy:
- Hệ thống đã có `behavior-tracker.js` capture raw click coordinates và lưu vào `behavior_events` (xem `backend/src/services/behaviorStore.js:21`).
- Endpoint `GET /api/behavior/compare` (xem `backend/src/routes/behavior.js:47-57`) đã trả về `points[]` với `{x, y, clicks, actions}` cho cả A và B.
- `frontend/js/insights.js:129-137` đã vẽ measured points bằng radial gradient nhưng **chưa có số thứ tự rank** và bubble label.
- `frontend/js/insights.js:97-104` (`pointDensity()`) đã có logic đếm số click trong bán kính 36px — chính là logic cần thiết cho ranking.
- `behaviorMath.js:12-19` (`monthBounds()`) chỉ nhận format `YYYY-MM` — cần mở rộng để nhận `YYYY-MM-DD`.
- 2 input chọn tháng tại `frontend/analysis.html:38` cần thay bằng 2 datepicker.

Sau khi triển khai, người dùng sẽ thấy các bubble số (1, 2, 3, …) chồng lên ảnh tham chiếu trang tại vị trí click thật — tương tự giao diện Clarity, với cùng thứ hạng ở hai khoảng thời gian do người dùng chọn.

## Files sẽ sửa đổi

### 1. `backend/src/services/behaviorMath.js`
- Thêm `dayBounds(startDate, endDate)` song song với `monthBounds(month)` hiện có. Hàm mới:
  - Validate input `YYYY-MM-DD`, đảm bảo `startDate <= endDate` và khoảng không quá 1 năm (để tránh query quá nặng).
  - Trả `{ start, end, timezone }` cùng format với `monthBounds()`.
- `compare()` (line 22): không cần đổi vì nó làm việc với `a.cells` / `b.cells` đã có cấu trúc giống nhau.

### 2. `backend/src/routes/behavior.js`
- Tại `options(req)` (line 39-46): chấp nhận `startA`, `endA`, `startB`, `endB` song song với `monthA`, `monthB`. Một request có thể dùng một trong hai nhưng không pha trộn.
- Tại `report()` call (line 49): truyền `bounds` tương ứng xuống `store.report()`.
- Tại `POST /notes` (line 65-72): validate date range thay vì `monthBounds(monthA)` / `monthBounds(monthB)` nếu note dùng date range.

### 3. `backend/src/services/behaviorStore.js`
- Tại `report()` (line 35-51): chấp nhận `start` và `end` thay vì `month`. Dùng `start` / `end` trong câu SQL `WHERE c.occurred_at >= ? AND c.occurred_at < ?`. Các trường khác giữ nguyên.
- Khi response trả về: thay `month: month` thành `{ start, end }` để frontend nhận biết.

### 4. `frontend/analysis.html` (line 38)
- Thay `<input type="month" id="monthA">` thành 2 input:
  - `<input type="date" id="startA" required>` và `<input type="date" id="endA" required>`
  - `<input type="date" id="startB" required>` và `<input type="date" id="endB" required>`
- Mặc định: A = 30 ngày gần nhất, B = 30 ngày trước đó (tính từ hôm nay).

### 5. `frontend/js/insights.js`
- Hàm `chosen()` (line 40-43): thay `monthA` / `monthB` bằng `startA`, `endA`, `startB`, `endB`. Truyền sang URL params.
- Hàm `loadReport()` (line 217-226): cập nhật tên params.
- Hàm `init()` (line 335): cập nhật default dates bằng `Date()` thay vì `getMonth()`.

### 6. `frontend/js/insights.js` — tính năng ranked bubbles (PHẦN CHÍNH)

Thêm vào `drawMap()` (line 105-149):

**a. Tính rank từ `pointDensity` đã có**:
```js
// Sau khi có report.pointDensity[period], thêm hàm:
function rankPoints(period) {
  const points = report.pointDensity[period]
    .filter(p => metric === 'actions' ? p.actions : p.clicks)
    .sort((a, b) => (metric === 'actions' ? b.actions : b.clicks) - (a.actions || a.clicks));
  const total = points.reduce((s, p) => s + (metric === 'actions' ? p.actions : p.clicks), 0);
  return points.map((p, i) => ({ ...p, rank: i + 1, percent: total ? Math.round((metric === 'actions' ? p.actions : p.clicks) / total * 1000) / 10 : 0 }));
}
```

**b. Render ranked bubbles** (thay thế đoạn circle gradient ở line 129-137):
```js
if (Array.isArray(r.points) && metric !== 'delta') {
  const ranked = rankPoints(period).slice(0, 10); // Top 10 như Clarity
  const maxPoint = Math.max(.000001, ...ranked.map(p => p.value));
  for (const p of ranked) {
    const count = metric === 'actions' ? p.actions : p.clicks;
    const gid = `ranked-${period}-${p.rank}`;
    const gradient = svgEl('radialGradient', { id: gid });
    gradient.append(/* stops theo heat level */);
    defs.append(gradient);
    
    // Outer halo
    svg.append(svgEl('circle', { cx: p.x, cy: p.y, r: 28, fill: `url(#${gid})` }));
    
    // Rank badge (white circle + number)
    const badge = svgEl('g', { class: 'rank-badge', 'data-rank': p.rank });
    badge.append(svgEl('circle', { cx: p.x, cy: p.y, r: 16, fill: '#214e8a', stroke: '#fff', 'stroke-width': 2 }));
    const num = svgEl('text', { x: p.x, y: p.y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 13, 'font-weight': 600 });
    num.textContent = p.rank;
    badge.append(num);
    
    // Tooltip
    const title = svgEl('title');
    title.textContent = `Hạng ${p.rank} · ${count} lượt · ${p.percent}% tổng · X ${Math.round(p.x)} · Y ${Math.round(p.y)} · vùng lân cận ${p.nearbyCount} trong 36px`;
    badge.append(title);
    svg.append(badge);
  }
}
```

**d. CSS** (thêm vào `frontend/css/insights.css`):
```css
svg .rank-badge { cursor: pointer; transition: transform .25s; }
svg .rank-badge:hover { transform: scale(1.15); }
svg .rank-badge[data-rank="1"] circle { fill: #ee583b; }
svg .rank-badge[data-rank="2"] circle { fill: #eebf48; }
svg .rank-badge[data-rank="3"] circle { fill: #eebf48; }
```

### 7. `frontend/js/insights.js` — inspector cho ranked bubble (line 193-216)

Trong `inspect()`:
- Nếu `selected` là một ranked bubble (lưu `selected.rank`), hiển thị thêm "Hạng A / B" thay vì "Ô C{x} · R{y}".
- Tìm bubble tương ứng trong `report.pointDensity[period]` (cả A và B) để so sánh thứ hạng.

## Hàm / tiện ích tái sử dụng

| Hàm | Vị trí | Vai trò |
|-----|--------|---------|
| `pointDensity(r)` | `frontend/js/insights.js:97-104` | **Tái sử dụng** — đã đếm nearbyCount trong bán kính 36px |
| `drawMap(id, r, period)` | `frontend/js/insights.js:105-149` | **Sửa đổi** — thêm ranked bubbles |
| `compare(a, b)` | `backend/src/services/behaviorMath.js:75-79` | **Tái sử dụng** — không cần đổi |
| `monthBounds(month)` | `backend/src/services/behaviorMath.js:12-19` | **Giữ nguyên** — vẫn hỗ trợ legacy `YYYY-MM` |

## Verification

### 1. Backend tests
```bash
cd C:\laragon\www\dunnio-behavior-tracker\backend
node --test test/behavior.test.js
```
Cần bổ sung test mới cho:
- `dayBounds('2026-08-15', '2026-09-15')` trả đúng UTC timestamps.
- Endpoint `/api/behavior/compare?startA=...&endA=...&startB=...&endB=...` trả 200 với `a` và `b` có `points[]`.

### 2. Frontend smoke test (manual)
- Mở `http://localhost:3000/analysis.html?demo=1` (chế độ minh họa).
- Chọn một trang bất kỳ (ví dụ `/blog/what-suit-color-to-choose.html`).
- Đổi `startA` thành `2026-09-01`, `endA` thành `2026-09-30`.
- Đổi `startB` thành `2026-08-01`, `endB` thành `2026-08-31`.
- Bấm **So sánh**.
- **Kiểm tra**: trên cả hai panel A và B, các bubble số 1, 2, 3 … xuất hiện trên heatmap tại các vị trí click thật, với badge màu (đỏ cho #1, vàng cho #2-3, xanh cho #4+).
- Click vào bubble #1 → inspector bên phải hiển thị "Hạng 1 · X lượt · Y% tổng".

### 3. Regression test
- Vẫn hỗ trợ legacy `monthA=2026-09&monthB=2026-08` cho backward compatibility.
- Bảng "Vùng nội dung đáng chú ý" (line 56-57 HTML) vẫn hoạt động.
- Bảng "Đối chiếu API" với compare-exports vẫn dùng API Clarity (không ảnh hưởng).

### 4. Edge cases
- Tracker chưa capture (trả `r.points = []`) → ranked bubbles không hiển thị, chỉ hiển thị cell-based heat (giống hiện tại).
- `points` > 5000 (`pointsTruncated = true`) → tooltip cảnh báo "Đang hiển thị top 5.000 điểm, có thể thiếu 1 số vị trí".
- `startA > endA` → backend trả 400 với message "Khoảng ngày không hợp lệ".

## Lưu ý quan trọng

1. **Không phá vỡ tính năng đang chạy** — chỉ thêm/sửa, không xóa logic cũ.
2. **Measured points là nguồn chính** — không phụ thuộc Clarity API để tránh giới hạn 10 request/day.
4. CSS variables (`--heat-cool`, `--heat-warm`, `--heat-hot`) đã có sẵn trong `insights.css:1` — tận dụng để giữ thang màu thống nhất.