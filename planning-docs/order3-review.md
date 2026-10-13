# Order 3 independent review — 2026-10-11

Reviewed the design/implementation plan, collector, aggregate math/store/routes, migrations 011–013, archive service and dashboard. These findings refer to the source at review time; other agents are editing concurrently. No product files were changed. The standalone browser probe is `planning-docs/order3-review-probes.cjs`; it serves the real collector to local headless Chrome and captures actual HTTP requests. Existing unit/archive tests passed (15/15). A read-only MySQL literal probe could not connect because the default database does not exist (`ER_BAD_DB_ERROR`), so this review does **not** claim database restore or production end-to-end verification.

## 1. [P1] Geometry changes inflate the pageview denominator

**Location:** `tracker/touch-tracker.js:74–76` (`sync`).

`segment` uses the complete context, including viewport/document height, and every context change enqueues another `pageview`. Real Chrome probe: one navigation to `/public`, followed by a same-width height resize and content growth, produced **3 pageviews**. Mobile browser chrome resizing, responsive interactions and expanding/lazy-loaded content will therefore increase `summary.pageviews` and depress `tapsPer100Views` without another page visit. The README calls these geometry segments, but the report/API/UI label and use them as pageviews.

**Fix:** separate page navigation identity from geometry partitioning. Keep new tap contexts when dimensions change, but only count a pageview for an actual page/navigation (define how a changed width is attributed). Add a browser assertion that same-path height changes preserve one pageview and a real path navigation adds one.

## 2. [P2] Valid six-decimal sample rates disable the SDK

**Location:** `tracker/touch-tracker.js:17` (`validConfig`).

The exact `Math.round(rate * 1e6) === rate * 1e6` check rejects valid decimal inputs because of binary floating-point multiplication. Measured examples: `.000123 * 1e6` is `123.00000000000001`, and `.000249 * 1e6` is `248.99999999999997`. Real Chrome with `.000123` returned `configValid:false`, `active:false`, `sampled:null`, with consent enabled. The backend accepts these rates using its `toFixed(6)` check, so a server-valid installation can collect nothing.

**Fix:** use the same decimal validation as the backend, preserving the SDK's explicit zero-disabled option. Test `.000123` and `.000249` with deterministic sampling. Earlier suggested `.016003` and `.123457` examples were checked and **do pass** on this runtime; do not use them as failing regressions.

## 3. [P2] Checksummed archives can restore internally inconsistent aggregates

**Location:** `backend/src/services/touchArchive.js:63–73` (`validatePayload`).

The semantic validator checks hash syntax but never reconstructs dimension hashes, checks grid/bin/anchor fields, or reconciles page taps against point/element counts. An independently constructed valid aggregate fixture continued to pass `validatePayload` after each separate mutation: page taps changed from 1 to 999 while points/elements remained 1; element count changed to 0; point dimension hash replaced by 64 `f` characters; point grid column changed to 255. Those values fit the SQL schema (including the zero count and column 255), so schema-column matching at restore is not an adequate fallback. They can produce inconsistent summary vs heatmap counts, off-grid report coordinates or a zero-divided centroid. A recomputed checksum only proves the altered file is intact; it does not establish these invariants.

**Fix:** validate table-specific fields, positive point/element counts, finite and geometrically plausible sums/bounds, sample precision, valid bin/column/row ranges, unique natural identities and recomputed dimension hashes. Reconcile taps across all three tables per site/date/context, and require archived page metadata for every reported path. Reject invalid archives before database/assets are modified. Add actual restore rejection tests in addition to validator tests.

## 4. [P2] Archive export can round BIGINT counts before hashing

**Location:** `backend/src/services/touchArchive.js:33,48`; `backend/src/config/database.js:5–16`.

Export uses `SELECT *` then JSON serialization. The pool does not enable `supportBigNumbers`/`bigNumberStrings`; the installed mysql2 binary parser consequently reads `LONGLONG` via a JavaScript-number conversion. Aggregate BIGINT values beyond `Number.MAX_SAFE_INTEGER` can therefore be rounded before archive serialization/checksum, and the restore count validator accepts that rounded integer. Report `safeCount` rejects unsafe JSON counts, but export bypasses it. This is source/driver inspection, not a successfully executed DB probe.

**Fix:** export BIGINT counters as exact decimal strings (query casts, appropriate query/pool options, or type casting) and enforce their unsigned BIGINT range. Preserve exact strings through restore; report can continue to reject values beyond safe JSON count precision. Verify round-trip using an isolated BIGINT value `9007199254740993`.

## 5. [P2] Backend private-route exclusions are weaker than the collector's

**Location:** `backend/src/services/behaviorMath.js:9`, called from `touchMath.validateBatch` and archive validation.

The SDK excludes `users`, `logout`, `signin`, `signup`, `auth`, `payment` and `billing`, but the server's shared `cleanPath` omits these. Direct validation probes accepted `/users/profile`, `/auth/callback`, `/payment/result`, `/billing`, and `/signin`. With an all-public site or registered path, the collector endpoint can persist these paths despite the documented private-route policy. Client-side exclusions do not enforce the server/archive boundary.

**Fix:** share or synchronize the deny list across SDK, server and archive handling; test plain and percent-encoded variants. This requires no collection or inspection of real private data.

## 6. [P2] Element position and bounds are absent from the usable comparison UI

**Location:** `frontend/js/touch.js:34,37,42` (per-period element table, comparison table, CSV export).

The API provides per-period element centroids/bounds and comparison `positionA`/`positionB`, but the UI only exposes a compatibility string. Its element table contains counts/region/key quality, and CSV similarly omits positions. Users cannot inspect how an explicitly keyed image/button moved across versions without manually reading raw JSON. The current string also says “khóa structural” for any incompatibility, including an explicit key across changed layout, which obscures the actual reason.

**Fix:** show each period's centroid and bounds with plane/layout/width context, and show A/B positions as separately labeled coordinates. Only calculate/display a positional delta when `positionComparable` is true; cross-version explicit totals remain comparable while coordinates remain descriptive. Carry these descriptive fields into CSV and distinguish missing data, changed geometry and structural identity limitations. Verify with an explicit element whose bounds move between two layout versions.
