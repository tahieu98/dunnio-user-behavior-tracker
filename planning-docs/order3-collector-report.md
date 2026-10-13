# Order 3 Task 2 — browser collector evidence

Completed 2026-10-11 in `C:\laragon\www\dunnio-behavior-tracker`. Owned changes only: `tracker/touch-tracker.js`, `tracker/TOUCH-README.md`, `backend/test/browser/touch-collector.spec.js`, `backend/touch-collector.playwright.config.js`, this report. No dependency changes, old tracker edits, Git operations, production database changes or external transmissions.

The public API is `window.DUNNIO_TOUCH_CONFIG` and `window.dunnioTouch.{setConsent,flush,getState}`. README includes an integration snippet with `consent:false`, exact allowlisted pages and `/api` endpoint. Payload conforms to collector schemaVersion 1 and posts to `/api/tracker/touch`; a sealed pending batch holds one geometry/path context. A public `flush()` sends/retries one batch, while ten-second scheduling handles later batches.

Implemented consent-first capture, DNT/GPC override, private routes/forms/controls/editable/private descendants, primary trusted pointerdown/pointerup capture, movement/scroll/cancel/long-gesture cancellation, no click listener, structural hashes using only tags/sibling indices, explicit element keys, local U/V and measured rects, fixed/sticky viewport plane, SPA path checks and resize/height geometry segments. Counts coalesce only within the UTC+07 day, same 20px bucket, 12-column/50px-row reporting cell, relative20 bin, element/region/anchor quality, pointer type, fixed plane and geometry/rect.

Pending UUID and exact payload survive network/HTTP failures and consented same-tab reloads. New events do not mutate a pending batch. Sampling is retained while recovering an unsent queue. HTTP success is the acknowledgement; no sendBeacon return value can release a batch. Queue capacity is 1000 aggregate entries including pending; `getState()` exposes `droppedCount`, `unsupportedGeometryCount`, queue totals and transport error. Entries expire after 23h59m. Revocation removes sessionStorage queue data and aborts the current request.

## Executed checks

From `backend`:

```powershell
npx playwright test -c touch-collector.playwright.config.js
```

Final result: **22 passed in 49.0s**, eleven cases each in headless installed Chrome **155.0.8059.39** and Edge **155.0.4283.45**, Node **v24.19.0**. Syntax checks `node --check tracker/touch-tracker.js`, `node --check backend/test/browser/touch-collector.spec.js`, `node --check backend/touch-collector.playwright.config.js` also passed. Test output is under `test-results/touch-collector`.

The fixture serves the real collector script over a localhost Node HTTP server. Mouse input uses Playwright's native browser pointer events; touch uses touchscreen and CDP native touch dispatch. The HTTP server records actual POST JSON, returns controlled 503/429 status or closes a real socket. The collector, pointer handlers and Fetch are not mocked. Tests cover:

1. No capture before consent; two matching native mouse releases coalesce to count 2; synthetic `.click()` and keyboard Enter add no tap; forms and marked private descendants add no tap; revocation stops capture.
2. A native touch tap produces one touch tap despite compatibility click; moved touch, mouse drag that returns to its start, and mouse-down/document-scroll/mouse-up produce no extra tap.
3. DNT, GPC, private `/account`, empty allowed paths, sampleRate 2 and sampleRate 0 produce no network request.
4. Long-page tap records document Y=2250 with original element rect and U/V=.25. Fixed tap records viewport Y=60 while scrolled. Dynamic width changes from 400px to 320px and retains U=.25 with distinct viewport contexts.
5. Structural fallback contains no DOM ID, link text, input value, href or secret query/hash. SPA public paths partition batches; a subsequent private path contributes no tap.
6. A 503 retry, failed pagehide send, reload, 429 response and eventual success retain byte-identical pending payload/UUID. Later taps remain separate; batch limits remain <=100 entries and <64KiB.
7. Taps at 23:59:59 and 00:00:01 UTC+07 are two distinct daily aggregates, each count 1.
8. 1020 native clicks with distinct explicit identities plus one pageview leave a 1000-entry queue and expose 21 dropped counts. A sendBeacon stub returning true cannot acknowledge a failed Fetch/pagehide delivery. Retried batch bytes remain identical.
9. Taps (415,49), (418,49), (415,51) within common 20px/relative bins preserve cells (5,1), (6,1), (5,2), each count 1.
10. A real socket failure exposes `lastError:'network'`, retains all counts and retries identical JSON. Adjacent Y=149/151 taps keep relative V bins 4/5.
11. A reload whose new random sampling draw would exclude the page still recovers its existing consented unsent batch unchanged.

## Limits and deliberate v1 behavior

- The backend v1 context has no documentWidth and rejects X >= viewportWidth. Horizontally overflowed document taps are skipped, with one count in both `droppedCount` and `unsupportedGeometryCount`; they are not clipped or misrepresented. The browser test verifies a document X=1150 point at viewport width 1000 is omitted and flagged. Full horizontal-page heatmaps require a future schema/geometry extension.
- SessionStorage persistence is same-tab and conditional on consent/storage availability. Closed-tab/process recovery is not guaranteed; storage quota/disabled storage falls back to memory. Keepalive on termination is best effort; server receipts must dedupe an acknowledgement lost during unload. Already received requests cannot be recalled by revocation.
- Very small/large backend-invalid viewport/document dimensions stay inactive. CSS transforms and sticky/nested scrolled layouts require compatible snapshot/plane interpretation for trustworthy overlays. Structural hashes cannot prove same content across layout versions.
- No hardware phone, Safari/Firefox, real pen, production cross-origin/CORS host, offline process crash, storage-quota exhaustion, screenshot overlay rendering or MySQL persistence is tested by this fixture. Browser protocol correctness is measured here; backend dedupe/transactions and dashboard integration belong to the other tasks.

Self-review fixes made before final verification: border-box fixture clicks now have explicit zero borders so coordinate assertions match actual input; reload expectations account for pagehide's additional delivery attempt; client batching also preserves report grid boundaries; sample precision matches backend v1; horizontal overflow is surfaced rather than allowing one unsupported point to poison an entire batch; recovering queued data preserves sampling selection.
