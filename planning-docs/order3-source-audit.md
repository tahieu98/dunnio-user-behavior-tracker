# Order3 source audit — first-party touch analytics

Audited 2026-10-11. Scope: source in `C:/laragon/www/dunnio-behavior-tracker`; no product files modified. This is an architecture audit, not a production deployment or capacity benchmark. `SPEC.md` explicitly describes the original v1.0 plan and is not the current implementation contract. Current package/server version is 1.4.0. Source inspection covers the measured tracker, SQL migrations, analytics, Clarity workspace, snapshot capture, desktop backup and tests.

## Recommended decision

Extend the existing first-party collector and measured dashboard. Do not replace the Express/mysql2/vanilla stack, and do not try to derive raw touch coordinates from Clarity PNG/CSV/API exports. Add stable element identities, daily materialized counts, bounded heatmap tiles, generalized period comparisons and verified daily archives. Keep Clarity as a separately labeled reference source.

The first-party tracker can collect future data after deployment and consent; it cannot recover historical coordinates never collected. Restoring first-party archives can recover data actually saved, subject to the archive's recorded resolution and coverage.

## Existing reusable interfaces

All file paths below are relative to `C:/laragon/www/dunnio-behavior-tracker/`.

| File / interface | Existing behavior and reuse |
|---|---|
| `tracker/behavior-tracker.js`, `window.TRACKER_CONFIG` | Configurable endpoint/site key/layout version, consent, scope, sampling, allowed pages and goal paths. Tracks trusted pointer-generated `click`, pageview, four scroll milestones, marked region exposure and explicit actions. Use as the base collector. |
| `window.dunnioTracker.setConsent(boolean)`, `.flush(unload=false)`, `.trackAction(name, sourceId)`, `.getLastClickId()`, `.getState()` | Existing consent/CMP and success-callback integration. `trackAction` supports `form_success` and `customizer_start`; navigation confirmation is emitted on destination load. |
| `backend/src/routes/behavior.js`, `POST /api/tracker/events` | 120 requests/minute/IP, batch validation, configured origin/site lookup and ingest. Public key is a routing identifier, not a secret. |
| `backend/src/services/behaviorMath.js`, `validateBatch(input, now=Date.now())` | Requires `consent:true`, UUID event/view/session IDs, 1–50 events, supported event types, dimension limits and timestamps in the previous 24 hours through 5 minutes ahead. Whitelists fields and discards text/input payloads. |
| `behaviorMath.cleanPath(value)`, `toGrid(x,y,width)` | Excludes queries/fragments and sensitive route names; derives 12 columns and 50 CSS-pixel rows. This grid is already accurate for the recorded coordinate system. |
| `backend/src/services/behaviorStore.js`, `ingest(site,sessionId,events)` | Registered/enabled paths; session ID HMAC; transactional insertion; duplicate event UUID retries do not update measurements. Reuse the deduplication boundary. |
| `behaviorStore.report({siteId,path,month,device,version,width,start,end})` | Six SQL queries: grid cells, regions, totals, scroll, outcomes and raw coordinate counts. Actions use a matching click/session/site/view/layout/width within 30 minutes; clicks with several actions count once in the overall action numerator. |
| `GET /api/behavior/compare` | Two periods, months or inclusive calendar date ranges; UTC boundaries for Asia/Ho_Chi_Minh; separate reference snapshots and geometry warnings. Needs fixes below before extension. |
| `behaviorStore.catalog(options={numOfDays,exportId})` | Sites, pages, snapshots and observed layout/width combinations. Currently scans all raw events to discover layouts. |
| `backend/src/services/clarityHeatmapMath.js`, `date(value)`, `period(start,end)`, `change(a,b)`, `compare(reports,groups)` | Strict calendar validation; 2–12 imported periods; optional groups `{a:[reportId...], b:[reportId...]}`; same-cohort checks; disjoint-group checks; missing-value preservation and weighted rates. Reuse the validation and comparison concepts for measured daily records, not the Clarity-specific selector/metadata schema. |
| `backend/src/services/snapshotCapture.js`, `capture({siteId,pagePath,device='desktop',width=1440,version})`, `assetDirectory()`, `writeAsset(file,bytes)` | Immutable screenshots, masking input/private elements, page geometry checks, serialized capture and atomic file publication. Capture is restricted to public Dunnio origin. |
| `frontend/tracker-analysis.html`, `frontend/js/insights.js` | Existing dual heatmap, grid inspection, region table, date inputs, normalization, CSV and notes UI. The default `analysis.html` is the newer Clarity workspace; measured analytics are a separate page. |
| `backend/src/desktop/control.js`, internal `backup()` / `POST /api/desktop/backup` | Guarded desktop-only streamed `mysqldump --single-transaction` → gzip → atomic rename. Good pattern for full DB backup; currently lacks file assets and restore workflow. |

`tracker/clarity-tracker.js` also contains the same measured collector implementation. Keep one canonical source and generate/check the compatibility copy, otherwise fixes can diverge.

## Confirmed correctness gaps

1. **Wrong comparison B cohort.** `backend/src/routes/behavior.js:57–58` calls `store.report({...o, month:o.monthB,start:o.startB,end:o.endB})` without setting `version:o.versionB,width:o.widthB`. `report()` destructures only `version,width`. B therefore reads A's layout/width while B's screenshot and labels identify B. Existing integration test checks `comparableGeometry:false`, but never asserts B actually has distinct data. Fix before any multigroup extension.

2. **Invalid calendar dates accepted.** `behaviorMath.js:25` checks syntax then lets `Date.UTC` normalize impossible dates. Direct read-only probes accepted `2026-02-30` and month `2026-13`. Reuse `clarityHeatmapMath.date()` style round-trip validation and a shared range normalizer. Keep inclusive date selection translated once to `[startUTC,endUTC)`.

3. **Date-range notes exceed SQL column width.** `routes/behavior.js:83–85` stores `YYYY-MM-DD~YYYY-MM-DD` (21 characters) in `behavior_notes.period_a/period_b`, still `CHAR(7)` in `migrations/002_behavior_events.sql:64–65`. Migration 006 only adds comparison geometry. In strict SQL mode this fails; permissive modes truncate. Add explicit date columns or a structured comparison reference and migrate old month labels.

4. **Incomplete UI transition from months.** `insights.js:42` now returns `startA/endA/startB/endB`, but `loadArchiveReport()` passes these to an endpoint requiring `monthA/monthB`; CSV metadata/filename at lines 350–357 still use missing month fields; successful archive import at line 373 accesses a nonexistent `#monthA`. Update all serializers and UI messages together. Old browser tests still address `/analysis.html` and `#monthA`, whereas measured UI lives at `/tracker-analysis.html` with date controls.

5. **Per-element counts are absent in measured reporting.** Events have optional `element_key`, but reports only group by cell/region and `GROUP_CONCAT` names. A cell containing three elements does not tell how many clicks each received. Add a measured element table/query and daily element aggregates. `GROUP_CONCAT` can truncate and is not a reliable identity/count representation.

6. **Heatmap truncation changes distribution.** `behaviorStore.js:49` groups exact `x,y`, returns the 5,000 highest-frequency positions and sets `pointsTruncated`. Grid/totals remain complete, but the map can omit most one-off touches on busy pages. `insights.js:111–118` computes point percentages from returned points, not the full report click total, yet labels them `% tổng`. Dense point-neighborhood calculations can also become quadratic within a bucket. Use complete sparse pixel bins/tiles and explicit resolution; if displaying a sample, label the sample and use an honest denominator.

7. **Geometry equality is necessary but insufficient.** Same width/version/document height does not prove identical DOM layout: sticky elements, modals, accordion states, font/image shifts and personalized content can move independently. Current fixed headers receive `clientY + scrollY`, spreading the same button down the document. Snapshot capture can create a fresh `reference-*` version unrelated to a deployed tracker `layoutVersion`, so exact snapshot matching may never happen. The snapshot HTTP route does not forward a requested `version` although service supports one.

8. **Measurement names need precision.** Browser `click` captures activation taps/clicks, not all physical touches, touchmove, scroll gestures or multitouch. Keyboard activation is excluded (`detail===0`), and no pointer type is saved. Counts describe consenting observed traffic, not all visitors. Width resize creates another `pageview`; these are view segments, which can inflate the label “page views.” Sessions are sessionStorage/tab identities with no inactivity expiry, not people or a standard 30-minute session definition.

## Delivery, identity, consent and abuse risks

- UUID uniqueness plus transactional ingest is a useful at-most-once storage boundary, but delivery is best effort. Queue exists only in memory, drops oldest above 100, sends 30 at a time, and beacon acceptance immediately removes items without a server ACK. An unload while a fetch is active returns without flushing; navigation/offline closure can lose events. There is no bounded retry backoff, delivery ledger or loss counters. One invalid/stale event rejects and then drops the whole 4xx batch. Retrying after the 24-hour validation window cannot recover stale events.
- If durable delivery is required, persist a small consent-gated queue with original IDs, TTL, bounded bytes and explicit acknowledgments. Purge it on consent withdrawal; never promise zero loss on browser shutdown. Return per-batch status and distinguish validation rejection from retryable overload. Accepted retries must not increment daily rollups twice.
- Consent defaults false; `setConsent(false)` clears queued data/storage and stops observers. GPC/DNT block start/enqueue/flush. These are good defaults. However, a dynamic opt-out only prevents operations; it does not invoke the full clear routine. An in-flight already-sent request cannot be recalled. Avoid random resampling on every consent callback; choose a stable view/session sampling decision and record sampling policy. Do not scale sampled counts as if exact.
- `data-track-key` is the safe identity convention. Unmarked elements have no stable key; do not default to DOM text, input values or arbitrary IDs. Establish a reviewed element registry per layout with a stable semantic key, region, safe label and optional migration alias; mark critical CTAs in the actual website templates. Nested buttons/links and duplicate keys need validation. Observe dynamically inserted marked regions if SPA/dynamic content is in scope.
- `path` is fixed at initial script execution; SPA route changes are not measured correctly. Encoded malformed paths can throw at tracker initialization. Paths may still contain personal slugs/IDs beyond the blocked route-name list; key/region strings are client-controlled. Retain allowlists, path normalization and private-element rules, and audit server/proxy logs as well as database fields.
- Origin checking plus CORS stops casual cross-origin browser use, not forged HTTP clients. A public site key and `Origin` header can be copied. In `all-public` scope, attackers can create arbitrary new page rows. Add a bounded site/path catalog, per-site ingest quotas, endpoint bandwidth limits, bot/abuse counters, and reviewed reverse-proxy IP handling. No `trust proxy` setting currently exists, so behind a reverse proxy all requests may share one rate bucket. Do not blindly trust arbitrary forwarded headers.
- Reports are authenticated and modifications role-gated. There is no per-site membership model: every authenticated dashboard user can read all sites. This is acceptable only for the stated single organization; add authorization scope before multi-tenant hosting.
- Snapshot assets are served by public static middleware; their obscured filenames are not an access check. Current capture deliberately targets public pages, but imported heatmap metadata/images may still warrant authenticated asset delivery. Backup dumps include sensitive application data; protect them outside the public frontend root.
- Session HMAC uses `JWT_SECRET`; rotating login signing keys changes future analytic identity. Separate analytics pseudonymization key/version from auth secret if longer-term session semantics matter. Treat hashes as pseudonymous data, not anonymous by definition.

## Minimal incremental architecture

### 1. Fix and define the event contract

Keep `/api/tracker/events`, whitelist validation and event UUIDs. Version the schema. Define `page_view_id` distinct from geometry segment ID; add `pointer_type` when available, stable `element_key`, deployed `layout_version`, and geometry mode for document content versus fixed/sticky overlays. Only count an event once—avoid simultaneously listening to touchend and synthetic click. Preserve one activation stream and an explicit metric definition.

Use exact viewport width when claiming pixel overlays. Different widths can share an element comparison but not automatically a pixel map. A coarse breakpoint bucket may be useful for count reports; it does not prove geometry compatibility. Display an independent grid or separate maps when historical snapshot identity is missing. Do not stretch coordinates onto an unrelated current screenshot.

### 2. Add daily aggregates without an infrastructure rewrite

Use a separate worker/CLI in the same Node project with MySQL transactions and a single-worker lock. Start with indexed raw input and rebuild affected day/cohort partitions idempotently; avoid immediately introducing Kafka, Redis or a second analytics database.

Suggested additive tables:

- `behavior_daily_totals`: site, canonical page ID, local date, device, layout, width/geometry cohort; counts for logical pageviews/view segments, clicks, action-linked clicks, coverage and schema/aggregation revision.
- `behavior_daily_cells`: the same cohort plus grid column/row, with click/action counters.
- `behavior_daily_elements`: cohort plus stable element ID/key, with click/action counters; optional element exposure only if truly instrumented.
- `behavior_daily_heat_bins`: cohort plus fixed-resolution tile/bin key, counts; store sparse occupied bins only. A documented 8–16 CSS-pixel resolution is a candidate to benchmark, not an accuracy claim. Preserve raw coordinates for a short investigation window if required.
- `behavior_daily_regions` / scroll milestones if those existing metrics remain required.
- `behavior_rollup_runs` and `behavior_archive_manifest`: period/cohort coverage, input watermark, finalized state, revision, content checksums, timestamps and failure details.

Do not create a dense cross product of every page × width × date × cell × element × session. Cells, elements and heat bins are different aggregate tables. Use numeric page/layout/element references if repeated strings dominate size. Add indexes after `EXPLAIN`; current `idx_period(site_id,page_path,device,layout_version,occurred_at)` omits exact width and all reports repeatedly scan raw rows.

Ingest commits accepted raw rows first. A retry-safe worker rebuilds or incrementally applies only new accepted events. Action attribution can arrive after its click's local day and must update the click day. Keep the latest three local dates provisional/rebuildable for the current 24-hour accepted lateness plus 30-minute attribution window; derive finalization from the actual accepted-window policy and watermarks. Do not delete raw records before successful finalization and verified archival. Detect late arrivals and publish a new daily revision rather than silently treating an old archive as final.

Counts sum; rates do not. Compute grouped action rate as `sum(action-linked clicks)/sum(clicks)`. Compute per-100 views from total numerator and denominator. Daily distinct sessions cannot be summed into unique sessions across a multi-day period. Either retain a documented set/sketch for union queries, query surviving raw identity records, or omit the unique metric for archived groups; do not label a sum of daily uniques “unique sessions.”

### 3. Generalize comparison while preserving provenance

Add a bounded request such as `POST /api/behavior/comparisons` with a cohort, `periods:[{id,start,end},...]` and optional `groups:[{id,periodIds:[...]}]`; 2–12 periods is consistent with the existing workspace. Query the union of requested dates once, assemble periods from daily rows, and serve only requested dimensions/maps.

Validate real dates, inclusive bounds, maximum span, same site/page/device and compatible geometry. Reject overlapping periods inside summed groups (or explicitly calculate their set union); do not double count. It is possible to show overlapping periods side-by-side, with a clear overlap marker. Compare element keys across layout changes using explicit aliases; gate cell/point deltas on geometry compatibility. Standardize difference direction: measured math currently uses A−B while Clarity workspace uses B−A.

Represent missing/partial days independently from true zero-count complete days. Return `coverage`, `provisional`, `missingDays`, aggregation revision, input sampling policy and source. Use weighted normalized rates for unequal durations. Extend CSV/notes to carry exact dates, group definitions and cohort identity.

### 4. Daily archive and local restore

Distinguish two artifacts: a small daily analytics archive for long-term comparisons, and a complete disaster-recovery backup containing DB plus assets/configuration requirements. The existing desktop SQL.gz is only the database portion; it is manual, desktop-specific, has no retention scheduler and no restore endpoint.

A daily archive should contain a versioned manifest, timezone/day boundary, site/page/layout/element dictionaries, aggregate tables, coverage/finalization status and referenced immutable snapshot files (or content-addressed references with verified availability). Compress it, checksum it, write a temporary file then atomically publish. Use an authenticated download/sync mechanism to the user's machine; when that machine is offline retain a server spool and catch up next time. Track download/checksum confirmation and restore tests separately. A second folder on the same VPS is not protection from VPS disk loss.

Restore to a separate local/staging database or archive namespace, validate manifest version/checksums/expected row counts before exposing reports, then make an atomic activation. Re-import the same archive idempotently; do not add counts twice. Enforce safe extraction paths and decompression/size limits. Preserve source day+revision identities so a later corrected archive can replace the intended partition. Test restoring after removing access to the source VPS, including screenshots and multi-period reports.

### 5. Retention and capacity controls

`backend/src/retention.js` currently deletes raw events older than default 400 days (configurable 30–730) in 10,000-row loops; there is no rollup/archive prerequisite or occurred_at-only retention index. Long historical reports disappear after deletion. Replace this with policy gated on aggregate completeness and archive verification. A 7–30 day raw window is a candidate operational policy after requirements are agreed; it requires changing the existing minimum if under 30 days. Keep compact aggregates longer, and measure their real cardinality.

For planning only, let `V` = tracked pageviews/day and `E` = events per view. Raw events/day = `V×E`; at a conservative illustrative 12 events/view, 10k/100k/1m views/day gives 120k/1.2m/12m events/day. Average event rates are approximately 1.4/13.9/138.9 per second, but peak-to-average factors and batch flush behavior determine the actual load.

Use an explicit provisional 0.8–2 KB per indexed raw row until `information_schema` measurement replaces it: 100k tracked views/day at 12 events/view yields roughly 1–2.4 GB raw growth/day, 29–72 GB over 30 days, before backups, binlogs, snapshots and free-space reserve. This is a sizing assumption, not a measured footprint. Existing wide VARCHAR/UUID columns plus several indexes can be costly. Exact coordinate aggregates may approach raw click cardinality; materialization alone does not guarantee compression.

A small isolated pilot could start on 2 vCPU/4 GB RAM with SSD; 4 vCPU/8 GB provides a more comfortable single-node Node+MySQL evaluation baseline. Neither is a supported traffic guarantee without a benchmark. Website/PHP load sharing the VPS, screenshot browsers, DB buffer pool, disk IOPS and backup jobs materially change capacity. Run capture/backup off peak or off the ingest host. The existing MySQL pool has 10 connections and an unbounded waiting queue; one A/B report already launches 12 analytical queries. Bound report concurrency/timeouts and use aggregates before allowing many 12-period comparisons.

Measure requests/events accepted and rejected, 429s, queue wait, commit p95, report p95, CPU/RAM, DB/index bytes/day, disk free space, raw/rollup lag and last verified local archive. Load-test the actual cohort distribution, event mix and burst factor; row count alone is insufficient. No vendor pricing or current service capacity is claimed here.

## Verification and acceptance work

Read-only execution: `node --test test/behavior.test.js test/clarity-workspace.test.js` in `backend/` passed all 14 tests. This covers existing grid/month/privacy/math and Clarity date/group comparison semantics. No DB-backed or browser test was run; they create application data/artifacts and are beyond this read-only audit. Direct in-memory probes reproduced invalid date acceptance in measured `dayBounds`.

Required implementation checks should target real failure modes: distinct A/B layouts with nonoverlapping data; impossible dates and local midnight; repeated ingest/worker runs; actions received across midnight and near the lateness limit; consent revoke/regrant and queue retry; logical pageviews across resize; stable element counts across nested elements; missing days versus zero; overlapping group rejection/union; unequal-period weighted rates; exact count conservation between raw/cell/element/bin totals; snapshot compatibility; interrupted archive publication; checksum rejection and duplicate restore; restore of a complete selected period with the VPS unavailable. Refresh stale browser tests to exercise the measured page and the current date UI.

No Order3 feature is represented as implemented by this report.
