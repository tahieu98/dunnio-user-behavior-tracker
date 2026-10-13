# Dunnio Touch collector v1

Load this standalone collector alongside the site only after configuring its public site key and registered paths. Register the site origin and each public page with the backend first. Serve the script locally or from your own collector host; no CDN or third-party analytics service is required.

```html
<script>
window.DUNNIO_TOUCH_CONFIG = {
  apiEndpoint: 'https://collector.example/api',
  siteKey: 'YOUR_PUBLIC_SITE_KEY',
  layoutVersion: 'release-1',
  consent: false,
  allowedPaths: ['/blog/example.html', '/products/example.html'],
  sampleRate: 1
};
</script>
<script defer src="https://collector.example/tracker/touch-tracker.js"></script>
```

`apiEndpoint` must end in `/api` and have no query, fragment or credentials. The collector posts to `/api/tracker/touch`. Site key, layout version and explicit anchors accept 1–80 ASCII letters, digits, underscore, dot, colon or hyphen. `sampleRate` accepts 0 (disabled), or 0.000001–1 with at most six decimal places. Sampling chooses the current loaded collector once, after consent, without a user/session identifier. Reloads recovering a consented unsent queue preserve its sampled selection so an unacknowledged batch is not resampled away. Counts are received sampled interactions; they are not unique users and are not extrapolated.

Connect the existing consent manager's analytics decision on every load:

```js
window.dunnioTouch.setConsent(true);  // Only after analytics consent is granted.
window.dunnioTouch.setConsent(false); // Revocation clears queued/persisted data and aborts an in-flight request.
await window.dunnioTouch.flush();     // Sends/retries one sealed batch; returns true on HTTP success.
console.log(window.dunnioTouch.getState());
```

Grant consent after the collector has loaded. Do not put `consent:true` in a public snippet unless the site has already established analytics consent. No event or queue storage is created while consent is false. DNT (`1`) and GPC override consent. Allowed paths match `location.pathname` exactly; an empty list tracks nothing. Checkout, cart, account, admin, login, auth, search, payment, billing, profile, register and API routes remain excluded even when listed, including percent-encoded path segments. Query strings and fragments are discarded; do not register paths that themselves contain personal identifiers.

Use stable, nonpersonal keys for meaningful elements and regions:

```html
<article data-track-region="article">
  <button data-track-key="size-guide">Size guide</button>
  <div data-track-private><!-- Never tracked, including descendants. --></div>
</article>
```

Forms, input controls, editable content and private descendants are excluded. Text, input values, DOM IDs, CSS classes, hrefs, query strings, cookies, IPs, user-agent strings and person/session IDs are not put in payloads. Unkeyed elements receive a tag-and-sibling-position hash with `anchorQuality: 'structural'`. These hashes describe DOM structure; they do not establish content identity across layouts. Change `layoutVersion` whenever relevant page layout or content changes. Keep the same explicit key only when it still names the same intended image, control or content element; give a replacement with different meaning a new key. The collector cannot infer semantic identity from pixels, DOM position or text, and an explicit key is the site's declared identity rather than automatic proof. Counts for a stable explicit key may be compared across versions; geometry must remain compatible before treating positional differences as comparable.

Only trusted, primary mouse/touch/pen pointer releases with a matching pointerdown are taps. Movement over 8 CSS pixels, any document/nested scrolling, cancellation, button mismatch or a gesture longer than one second cancels capture. Compatibility clicks, programmatic clicks and keyboard activation add no spatial tap. Fixed and sticky ancestors use viewport coordinates with `fixed:true`; other elements use document coordinates and rects. Element U/V are normalized against the measured border rectangle, not the whole page.

The v1 payload has viewport width but no document width. Horizontal document points whose X falls outside viewport width are skipped and counted in `unsupportedGeometryCount` and `droppedCount`. They are never clipped or relabeled as viewport coordinates. Very small/huge viewports outside backend limits (width/height 100–10000; document height 100–200000) are unsupported. CSS transforms, nested element scrolling and sticky elements need a matching snapshot/plane for reliable visual overlays; `fixed:true` identifies the separate plane rather than an original unscrolled document position.

Tap aggregation preserves the UTC+07 day, 20px spatial bucket, 12-column/50px-row reporting cell, element identity, relative 20×20 bin, pointer type, fixed plane, measured rectangle and page geometry. Pageviews are **width-segmented views**: the initial consented page load, a changed public pathname, or a changed viewport width starts one view attributed to that path and width. Returning to an earlier width starts another width segment, so summing views across widths does not measure unique visits. Same-width viewport-height changes (such as mobile browser toolbars) and expanding/lazy-loaded document height preserve one pageview; taps still carry each new geometry in separate batches. Query-only and hash-only History changes add no view. Reports filtered to a selected width use that width's segmented view count for the denominator. Path is checked again at each gesture and periodic flush; private SPA routes do not inherit the preceding page's identity. Integrations that replace the History methods after the collector loads should preserve the wrapper; context is still checked at the next gesture/ten-second tick.

The in-memory queue has a cap of 1000 aggregate entries, including a sealed pending batch. Each entry count is at most 10000. New aggregates beyond capacity, expired data and unsupported points increment `droppedCount`. Up to 100 entries and under 60KB are sealed into each batch. Ten-second flushes, visibility changes and pagehide use Fetch with `keepalive`; `sendBeacon` is not used as an acknowledgement. HTTP success alone removes a batch. Any network/HTTP failure retains its exact batch ID, timestamp, body and counts; later taps remain separate until it is acknowledged. Transient failures retry on the next timer or explicit `flush()`. Permanent 4xx failures are exposed as `lastError` and retain the batch until correction or expiry.

Pending and unsent aggregates persist in same-tab `sessionStorage` after consent, so reload can retry the same UUID. Consent must be granted again to restore them. Closed-tab recovery is not guaranteed; disabled/quota-exceeded storage falls back to memory. A request already received by the server cannot be recalled on revocation. Delivery on tab/process termination is best effort, and server batch deduplication is required when delivery succeeds but its acknowledgement is lost. Entries expire after 23h59m, inside the backend's 24-hour acceptance window; expired immutable batches are dropped whole. Storage contains aggregate counts/geometry only and does not track a user across visits.

`getState()` returns `active`, `consent`, `sampled`, `configValid`, `queued` (entries), `queuedCount` (received event counts), `pendingBatchId`, `droppedCount`, `unsupportedGeometryCount`, and `lastError`. Inspect it when installing the collector. A single explicit `flush()` sends one batch; repeat while `queued > 0` and the previous call succeeded to drain all contexts immediately.

Run the standalone real-browser fixture checks from `backend`:

```powershell
npx playwright test -c touch-collector.playwright.config.js
```

The tests serve the actual product script with Node's HTTP server, use native Playwright mouse/touch input in installed Chrome and Edge, and inspect received JSON. They do not replace the collector implementation or Fetch protocol with a mocked collector. No production database or external recipient is used.
