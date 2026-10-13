# Dunnio Touch Heatmaps Implementation Plan

> For agentic workers: use Superpowers subagent-driven-development; each task has owned files, tests and review. No Git repository exists; preserve source and record completed work in `order3-progress.md` instead of commits.

**Goal:** ứng dụng đo điểm chạm thực, tổng hợp theo ngày/ô/phần tử, so sánh nhiều kỳ và lưu trữ local.
**Architecture:** module Express/MySQL trong dự án hiện có, tracker browser độc lập, vanilla frontend. Daily counters và archive gzip có thể khôi phục, không lưu từng raw tap lâu dài.
**Tech Stack:** Node.js, Express, mysql2, HTML/CSS/Canvas, node:test, Playwright hiện có.
**Spec:** `planning-docs/13-ORDER3-DESIGN.md` là hợp đồng API và giới hạn nguồn dữ liệu.

## Global Constraints

- Không xóa dữ liệu/mã Clarity hoặc tracker cũ; chỉ chuyển màn hình mặc định khi kiểm thử xong.
- Không gửi dữ liệu thật lên dịch vụ ngoài; user chọn local và chưa có VPS.
- Counts là lượt tương tác nhận được, không phải unique users; giữ sampleRate và cảnh báo dữ liệu thiếu.
- Mọi date/calendar/geometry/consent/retry phải được kiểm tra; không tạo tọa độ giả từ Clarity.
- Không thêm framework hoặc dependency khi thư viện hiện có/stdlib đáp ứng.

## Review Focus

- Race duplicate và batchId khác payload: một transaction, không double count.
- Múi giờ UTC+07 và ngày không tồn tại: inclusive end, calendar validation.
- Missing kỳ vs zero và geometry thay đổi: không tạo false delta.
- Consent/GPC và touch scroll: không thu trước consent, không double tap.
- Archive/snapshot: checksum, restore idempotency, không path traversal, không lẫn secret.

## Task 1: backend aggregates

Files: migration `011_touch_heatmaps.sql`; `src/services/touchMath.js`, `touchStore.js`; `src/routes/touch.js`; `test/touch.test.js`, `touch.integration.test.js`.
Interface: collector router `/touch`, dashboard router `/catalog` và `/report`; response phải theo spec. Store exports `ingest(site,batch)`, `catalog()`, `report(options)`; archive sẽ đọc bốn bảng theo schema migration.
- [x] Viết failing tests cho calendar, validation, B−A, zero/missing và compatible geometry.
- [x] Implement transactional counters, batch dedupe, metadata sampling and snapshot compatibility.
- [x] Chạy node:test unit + isolated review MySQL integration, concurrent duplicate/conflicting IDs và origin/auth checks.
- [x] Báo cáo schema/SQL interface và counts/test evidence cho parent, tự review.

## Task 2: browser collector

Files: `tracker/touch-tracker.js`, `tracker/TOUCH-README.md`, browser tests dedicated collector fixture.
Interface: `window.DUNNIO_TOUCH_CONFIG={apiEndpoint:"https://collector.example/api",siteKey,layoutVersion,consent:false,allowedPaths,sampleRate:1}`; `window.dunnioTouch={setConsent,flush,getState}`; POST `/api/tracker/touch` exact spec.
- [x] Viết browser checks no-consent, touch vs click/drag, element-relative positions and privacy exclusions.
- [x] Implement pointerup with movement cancellation, fixed plane, stable keyed elements, bounded retry queue and ACK semantics.
- [x] Verify same batch ID after retry; sampleRate/config sanity, cross-midnight/day segmentation.
- [x] Báo cáo browser evidence và public integration snippet.

## Task 3: interface and comparisons

Files: `frontend/touch.html`, `frontend/css/touch.css`, `frontend/js/touch.js`, browser UI tests.
Interface: API catalog/report from Task 1, existing auth token and behavior sites/snapshot APIs. Demo flag `?demo=1` is explicitly synthetic.
- [x] Generate design system using UI/UX Pro Max and read product chart rules.
- [x] Build date periods 1–12, group A/B, small multiples points/grid count tooltip, element deltas and CSV/JSON download.
- [x] Test 4 periods, reversed ranges, missing data, incompatible geometry, roles, XSS and mobile/desktop axe/screenshot.
- [x] Deliver usable UI with loading/empty/error states and consent snippet setup.

## Task 4: local archive, infrastructure and validation (parent)

Files: `backend/src/services/touchArchive.js`, scripts archive/restore/load, deployment Docker/Compose/env/proxy and scheduled jobs, operating guide and test evidence.
- [x] Wire routers/body parser/auth, run migrations; no dependency on Clarity data.
- [x] Implement export gzip+SHA256 snapshot bundle and restore transaction/dedupe; test round trip and corruption.
- [x] Run existing regression tests and new tests, end-to-end measured pointer capture and multi-period comparison.
- [x] Run measured HTTP/MySQL load test and store machine/runtime/database size evidence.
- [x] Validate deployment config statically; distinguish lack of Docker/VPS from executed local tests.
- [x] Add daily job export yesterday local, optional folder copy and explicit private GitHub/rclone setup instructions without credential uploads.
- [x] Independent spec+code review, fix issues and re-run affected checks; save actual completion ledger and docs.

Acceptance commands: `node --test test/touch.test.js`; `RUN_DB_TESTS=true node --test test/touch.integration.test.js`; dedicated Playwright config; `node scripts/touch-archive.js export --date YYYY-MM-DD`; `node scripts/touch-archive.js restore --file <archive>`; `node scripts/touch-load.js` with environment outside source. Commands invoked with PowerShell environment equivalents on this host.

## Completion record — 11/10/2026

Source v1.5 implemented and reviewed. Unit/HTTP/MySQL/archive/E2E 22/22, regression21/21, SDK Chrome/Edge28/28, UI8/8 passed. Native Windows lifecycle passed. Two local load profiles passed; deployment configuration prepared and reviewed, Docker/VPS not executed. Daily scheduling files provided, not installed. A newly created database restore probe was denied CREATE DATABASE by the scoped review account; empty-target-site restore and exact BIGINT round trip passed. Operations guide records these boundaries. See order3-progress.md and 15-ORDER3-OPERATIONS.md.
