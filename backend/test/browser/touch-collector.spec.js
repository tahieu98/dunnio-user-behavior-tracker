'use strict';
const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let server, origin, received, statuses;
const script = fs.readFileSync(path.resolve(__dirname, '../../../tracker/touch-tracker.js'), 'utf8');
const html = `<!doctype html><html><head><style>
body{margin:0;width:1500px;height:7000px}button,a{position:absolute;box-sizing:border-box;border:0;padding:0}
#explicit{left:40px;top:100px;width:400px;height:200px}#fallback{left:40px;top:350px;width:200px;height:80px}
#private{position:absolute;left:40px;top:450px}#private button{position:static;width:150px;height:50px}
form{position:absolute;left:230px;top:450px}form button{position:static;width:150px;height:50px}
#deep{left:40px;top:2200px;width:400px;height:200px}#wide{left:1100px;top:100px;width:200px;height:100px}
#fixed{position:fixed;left:550px;top:40px;width:100px;height:60px}#dynamic{left:40px;top:600px;width:40vw;height:80px}
</style></head><body><main data-track-region="article">
<button id="explicit" data-track-key="hero"><span>SECRET CUSTOMER NAME</span></button>
<a id="fallback" href="/account?token=SECRET-TOKEN" onclick="event.preventDefault()">SECRET LINK TEXT</a>
<div id="private" data-track-private><button>secret</button></div><form><button type="button">pay</button><input value="SECRET-INPUT"></form>
<button id="deep" data-track-key="deep">deep</button><button id="wide" data-track-key="wide">wide</button>
<button id="dynamic" data-track-key="dynamic">dynamic</button></main>
<button id="fixed" data-track-key="fixed">fixed</button>
<script>window.DUNNIO_TOUCH_CONFIG=window.fixtureConfig;</script><script src="/touch-tracker.js"></script></body></html>`;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/touch-tracker.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(script); }
    if (req.url === '/api/tracker/touch') {
      let body = ''; req.on('data', b => body += b); req.on('end', () => {
        received.push({ body, payload: JSON.parse(body) });
        const status = statuses.shift() || 200;
        if (status === -1) return req.socket.destroy();
        res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: status === 200 }));
      }); return;
    }
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
test.beforeEach(() => { received = []; statuses = []; });
async function boot(page, options = {}, pathname = '/public?private=SECRET-QUERY#SECRET-HASH') {
  await page.addInitScript(config => { window.fixtureConfig = config; }, { apiEndpoint: `${origin}/api`, siteKey: 'public-test', layoutVersion: 'v1', consent: false, allowedPaths: ['/public', '/second', '/account'], sampleRate: 1, ...options });
  await page.goto(origin + pathname);
  await expect.poll(() => page.evaluate(() => Boolean(window.dunnioTouch))).toBe(true);
}
async function consent(page) { await page.evaluate(() => window.dunnioTouch.setConsent(true)); }
async function drain(page) {
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => window.dunnioTouch.getState());
    if (!state.queued) break;
    if (!await page.evaluate(() => window.dunnioTouch.flush())) break;
  }
}
const taps = () => received.flatMap(r => r.payload.entries.filter(e => e.type === 'tap'));

test('requires consent, honours revocation, and never captures click duplicates or private controls', async ({ page }) => {
  await boot(page);
  await page.locator('#explicit').click(); await drain(page);
  expect(received).toHaveLength(0);
  await consent(page);
  await page.locator('#explicit').click({ position: { x: 100, y: 50 } });
  await page.locator('#explicit').click({ position: { x: 100, y: 50 } });
  await page.locator('#explicit').evaluate(el => el.click());
  await page.locator('#explicit').focus(); await page.keyboard.press('Enter');
  await page.locator('#private button').click(); await page.locator('form button').click();
  await drain(page);
  expect(taps()).toHaveLength(1); expect(taps()[0].count).toBe(2);
  expect(taps()[0]).toMatchObject({ elementKey: 'hero', anchorQuality: 'explicit', region: 'article', elementU: .25, elementV: .25, pointerType: 'mouse', fixed: false });
  expect(received[0].payload.context.pagePath).toBe('/public');
  await page.evaluate(() => window.dunnioTouch.setConsent(false));
  await page.locator('#explicit').click(); await drain(page);
  expect(received).toHaveLength(1);
  expect(await page.evaluate(() => window.dunnioTouch.getState().queued)).toBe(0);
});

test('real touch releases count once; dragged touch and scrolled mouse gestures cancel', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1000, height: 700 } });
  const page = await context.newPage(); await boot(page); await consent(page);
  await page.touchscreen.tap(140, 150);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 150 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 90 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.mouse.move(140, 150); await page.mouse.down();
  await page.mouse.move(170, 150); await page.mouse.move(140, 150); await page.mouse.up();
  await page.mouse.move(140, 150); await page.mouse.down();
  await page.evaluate(() => window.scrollTo(0, 10)); await page.mouse.up();
  await drain(page);
  expect(taps().reduce((n, e) => n + e.count, 0)).toBe(1);
  expect(taps()[0].pointerType).toBe('touch'); await context.close();
});

test('respects DNT, GPC, private routes, deny-by-default paths and invalid sampling', async ({ browser }) => {
  for (const mode of ['dnt', 'gpc', 'private', 'paths', 'rate', 'zero']) {
    const context = await browser.newContext(); const page = await context.newPage();
    if (mode === 'dnt') await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', { value: '1' }));
    if (mode === 'gpc') await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
    await boot(page, mode === 'paths' ? { allowedPaths: [] } : mode === 'rate' ? { sampleRate: 2 } : mode === 'zero' ? { sampleRate: 0 } : {}, mode === 'private' ? '/account' : '/public');
    await consent(page); await page.locator('#explicit').click(); await drain(page);
    expect(await page.evaluate(() => window.dunnioTouch.getState().active), mode).toBe(false);
    await context.close();
  }
  expect(received).toHaveLength(0);
});

test('keeps document, fixed and resized geometry accurate; flags horizontal overflow', async ({ page }) => {
  await boot(page); await consent(page);
  await page.locator('#deep').click({ position: { x: 100, y: 50 } });
  await page.locator('#fixed').click({ position: { x: 25, y: 20 } });
  await page.locator('#wide').click({ position: { x: 50, y: 30 } });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#dynamic').click({ position: { x: 100, y: 20 } });
  await page.setViewportSize({ width: 800, height: 700 });
  await page.locator('#dynamic').click({ position: { x: 80, y: 20 } });
  await drain(page);
  expect(taps().find(e => e.elementKey === 'deep')).toMatchObject({ x: 140, y: 2250, fixed: false, elementRect: { x: 40, y: 2200, width: 400, height: 200 }, elementU: .25, elementV: .25 });
  expect(taps().find(e => e.elementKey === 'fixed')).toMatchObject({ x: 575, y: 60, fixed: true, elementRect: { x: 550, y: 40, width: 100, height: 60 } });
  expect(taps().find(e => e.elementKey === 'wide')).toBeUndefined();
  expect(await page.evaluate(() => window.dunnioTouch.getState().unsupportedGeometryCount)).toBe(1);
  const dynamic = taps().filter(e => e.elementKey === 'dynamic');
  expect(dynamic.map(e => e.elementRect.width)).toEqual([400, 320]);
  expect(dynamic.map(e => e.elementU)).toEqual([.25, .25]);
  expect(received.filter(r => r.payload.entries.some(e => e.elementKey === 'dynamic')).map(r => r.payload.context.viewportWidth)).toEqual([1000, 800]);
});

test('sanitizes structural anchors and partitions SPA page paths', async ({ page }) => {
  await boot(page); await consent(page);
  await page.locator('#fallback').click();
  await page.evaluate(() => history.pushState({}, '', '/second?SECRET-SPA=1'));
  await page.locator('#explicit').click();
  await page.evaluate(() => history.pushState({}, '', '/account'));
  await page.locator('#explicit').click(); await drain(page);
  const fallback = taps().find(e => e.anchorQuality === 'structural');
  expect(fallback.elementKey).toMatch(/^structural:[0-9a-f]+$/);
  const serialized = JSON.stringify(received);
  expect(serialized).not.toContain('SECRET'); expect(serialized).not.toContain('href');
  expect(serialized).not.toContain('fallback'); expect(serialized).not.toContain('/account');
  expect(received.map(r => r.payload.context.pagePath)).toEqual(['/public', '/second']);
  expect(taps().reduce((n, e) => n + e.count, 0)).toBe(2);
});

test('retries identical sealed batches after HTTP failure and reload, then ACK releases them', async ({ page }) => {
  await boot(page, { consent: true });
  await page.locator('#explicit').click(); statuses.push(503);
  expect(await page.evaluate(() => window.dunnioTouch.flush())).toBe(false);
  const original = received[0].body;
  await page.locator('#explicit').click();
  statuses.push(503, 429);
  await page.reload();
  await expect.poll(() => received.length).toBe(2);
  expect(await page.evaluate(() => window.dunnioTouch.flush())).toBe(false);
  expect(received[1].body).toBe(original);
  expect(await page.evaluate(() => window.dunnioTouch.getState().pendingBatchId)).toBe(received[0].payload.batchId);
  await drain(page);
  expect(received.slice(0, 4).map(r => r.body)).toEqual([original, original, original, original]);
  expect(received.slice(4).flatMap(r => r.payload.entries.filter(e => e.type === 'tap')).reduce((n, e) => n + e.count, 0)).toBe(1);
  expect(await page.evaluate(() => window.dunnioTouch.getState().queued)).toBe(0);
  for (const r of received) { expect(Buffer.byteLength(r.body)).toBeLessThan(65536); expect(r.payload.entries.length).toBeLessThanOrEqual(100); }
});

test('local UTC+07 midnight creates distinct daily tap aggregates', async ({ page }) => {
  await boot(page);
  await page.clock.install({ time: new Date('2026-10-10T16:59:59.000Z') }); await consent(page);
  await page.locator('#explicit').click({ position: { x: 100, y: 50 } });
  await page.clock.setFixedTime(new Date('2026-10-10T17:00:01.000Z'));
  await page.locator('#explicit').click({ position: { x: 100, y: 50 } }); await drain(page);
  expect(taps()).toHaveLength(2); expect(taps().map(e => e.count)).toEqual([1, 1]);
  expect(taps().map(e => new Date(e.timestamp + 7 * 3600000).toISOString().slice(0, 10))).toEqual(['2026-10-10', '2026-10-11']);
});

test('bounded queue reports dropped counts and beacon delivery never acknowledges a batch', async ({ page }) => {
  test.setTimeout(60000);
  await page.clock.install(); await boot(page); await page.clock.pauseAt(new Date()); await consent(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'sendBeacon', { value: () => true }));
  // Changing a real rendered element's explicit key yields 1020 distinct identities.
  for (let index = 0; index < 1020; index++) {
    await page.locator('#explicit').evaluate((el, i) => el.setAttribute('data-track-key', `dynamic-${i}`), index);
    await page.mouse.click(140, 150);
  }
  const state = await page.evaluate(() => window.dunnioTouch.getState());
  expect(state.queued).toBeLessThanOrEqual(1000);
  expect(state.droppedCount).toBe(21);
  expect(state.queuedCount + state.droppedCount).toBe(1021);
  statuses.push(503);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => received.length).toBe(1);
  expect(await page.evaluate(() => window.dunnioTouch.getState().pendingBatchId)).toBe(received[0].payload.batchId);
  await drain(page);
  expect(received[1].body).toBe(received[0].body);
});

test('preserves 12-column and 50px-row boundaries inside the same 20px spatial and relative bins', async ({ page }) => {
  await boot(page); await consent(page);
  await page.evaluate(() => {
    const button = document.createElement('button'); button.dataset.trackKey = 'grid-boundary';
    button.style.cssText = 'left:0;top:0;width:1000px;height:700px;z-index:1000'; document.body.append(button);
  });
  await page.mouse.click(415, 49); await page.mouse.click(418, 49); await page.mouse.click(415, 51);
  await drain(page);
  const points = taps().filter(e => e.elementKey === 'grid-boundary');
  expect(points).toHaveLength(3); expect(points.map(e => e.count)).toEqual([1, 1, 1]);
  expect(points.map(e => [Math.floor(e.x / (1000 / 12)) + 1, Math.floor(e.y / 50) + 1])).toEqual([[5, 1], [6, 1], [5, 2]]);
});

test('retains identical batch after a real socket failure and preserves relative bins', async ({ page }) => {
  await boot(page); await consent(page);
  // Both taps are in spatial bucket y=140..159 and grid row 3, but different element-V bins.
  await page.mouse.click(140, 149); await page.mouse.click(140, 151);
  statuses.push(-1);
  expect(await page.evaluate(() => window.dunnioTouch.flush())).toBe(false);
  const state = await page.evaluate(() => window.dunnioTouch.getState());
  expect(state.lastError).toBe('network'); expect(state.queuedCount).toBe(3);
  await drain(page);
  expect(received[1].body).toBe(received[0].body);
  expect(received[1].payload.entries.filter(e => e.type === 'tap').map(e => Math.floor(e.elementV * 20))).toEqual([4, 5]);
});

test('does not resample away an unacknowledged batch on reload', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .1; });
  await boot(page, { consent: true, sampleRate: .5 });
  await page.locator('#explicit').click(); statuses.push(503);
  await page.evaluate(() => window.dunnioTouch.flush());
  const body = received[0].body;
  await page.addInitScript(() => { Math.random = () => .9; }); statuses.push(503);
  await page.reload(); await expect.poll(() => received.length).toBe(2);
  expect(await page.evaluate(() => window.dunnioTouch.getState().sampled)).toBe(true);
  await drain(page); expect(received[2].body).toBe(body);
});

test('height-only resize and content growth preserve one view while navigation and width start views', async ({ page }) => {
  await boot(page); await consent(page);
  await page.mouse.click(140, 150);
  await page.setViewportSize({ width: 1000, height: 600 }); await page.mouse.click(140, 150);
  await page.evaluate(() => { document.body.style.height = '8000px'; }); await page.mouse.click(140, 150);
  await page.evaluate(() => history.pushState({}, '', '/second')); await page.mouse.click(140, 150);
  await page.setViewportSize({ width: 800, height: 600 }); await page.mouse.click(140, 150);
  await drain(page);
  const counts = (pathname, width) => received.filter(r => r.payload.context.pagePath === pathname && r.payload.context.viewportWidth === width).flatMap(r => r.payload.entries).reduce((s, e) => { s[e.type] += e.count; return s; }, { pageview: 0, tap: 0 });
  expect(counts('/public', 1000)).toEqual({ pageview: 1, tap: 3 });
  expect(counts('/public', 1000).tap / counts('/public', 1000).pageview * 100).toBe(300);
  expect(counts('/second', 1000)).toEqual({ pageview: 1, tap: 1 });
  expect(counts('/second', 800)).toEqual({ pageview: 1, tap: 1 });
  expect(received.filter(r => r.payload.context.pagePath === '/public').map(r => [r.payload.context.viewportHeight, r.payload.context.documentHeight])).toEqual([[700, 7000], [600, 7000], [600, 8000]]);
  const newGeometry = received.filter(r => r.payload.context.pagePath === '/public').slice(1);
  expect(newGeometry.flatMap(r => r.payload.entries).every(e => e.type === 'tap')).toBe(true);
});

test('accepts exact six-decimal sample rates despite binary multiplier rounding', async ({ browser }) => {
  for (const sampleRate of [.000123, .000249]) {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.addInitScript(() => { Math.random = () => 0; });
    await boot(page, { sampleRate }); await consent(page); await page.mouse.click(140, 150); await drain(page);
    const state = await page.evaluate(() => window.dunnioTouch.getState());
    expect(state.configValid).toBe(true); expect(state.sampled).toBe(true); expect(state.active).toBe(true);
    expect(received.at(-1).payload.sampleRate).toBe(sampleRate);
    expect(received.at(-1).payload.entries.filter(e => e.type === 'pageview').reduce((s, e) => s + e.count, 0)).toBe(1);
    expect(received.at(-1).payload.entries.filter(e => e.type === 'tap').reduce((s, e) => s + e.count, 0)).toBe(1);
    await context.close();
  }
});

test('matches server private-route exclusions after percent-decoding', async ({ browser }) => {
  for (const pathname of ['/profile', '/register', '/api/private', '/%70rofile', '/%72egister', '/%61pi/private', '/%61ccount']) {
    const context = await browser.newContext(); const page = await context.newPage();
    await boot(page, { allowedPaths: [pathname] }, pathname); await consent(page);
    await page.mouse.click(140, 150); await drain(page);
    expect(await page.evaluate(() => window.dunnioTouch.getState().active), pathname).toBe(false);
    await context.close();
  }
  expect(received).toHaveLength(0);
});
