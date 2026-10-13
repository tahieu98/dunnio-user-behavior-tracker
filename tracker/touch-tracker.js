/** Dunnio Touch collector v1. Counts only trusted, stationary pointer releases after consent. */
(() => {
  'use strict';
  if (window.dunnioTouch) return;
  const cfg = { apiEndpoint: '', siteKey: '', layoutVersion: '', consent: false, allowedPaths: [], sampleRate: 1, ...window.DUNNIO_TOUCH_CONFIG };
  const KEY = /^[a-zA-Z0-9_.:-]{1,80}$/;
  const PRIVATE = 'form,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-track-private]';
  const LIMIT = 1000, DAY = 86400000, MAX_AGE = DAY - 60000;
  const pointers = new Map();
  let active = false, sampled = null, queue = new Map(), pending = null, sending = null;
  let dropped = 0, unsupportedGeometry = 0, lastError = null, segment = null, viewSegment = null, timer = null, requestAbort = null;
  let endpoint = null;
  try {
    const u = new URL(cfg.apiEndpoint, location.href);
    if (/^https?:$/.test(u.protocol) && /\/api\/?$/.test(u.pathname) && !u.search && !u.hash && !u.username && !u.password) endpoint = u.href.replace(/\/$/, '') + '/tracker/touch';
  } catch { /* Invalid configuration stays inactive. */ }
  const validConfig = endpoint && KEY.test(cfg.siteKey) && KEY.test(cfg.layoutVersion) && typeof cfg.sampleRate === 'number' && Number.isFinite(cfg.sampleRate) && cfg.sampleRate >= 0 && cfg.sampleRate <= 1 && (cfg.sampleRate === 0 || cfg.sampleRate >= 0.000001 && Number(cfg.sampleRate.toFixed(6)) === cfg.sampleRate) && Array.isArray(cfg.allowedPaths);
  const storageKey = `dunnio-touch-v1:${cfg.siteKey}:${cfg.layoutVersion}:${cfg.sampleRate}:${endpoint}`;
  const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  function allowed(path) {
    try {
      const decoded = decodeURIComponent(path);
      return !/(^|\/)(checkout|cart|account|my-account|wp-admin|admin|user|users|login|logout|signin|signup|auth|search|payment|billing|profile|register|api)(\/|$)/i.test(decoded) && !/[\u0000-\u001f]/.test(decoded) && cfg.allowedPaths.includes(path);
    } catch { return false; }
  }
  function context() {
    const width = innerWidth;
    return { pagePath: location.pathname, layoutVersion: cfg.layoutVersion, device: width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop', viewportWidth: width, viewportHeight: innerHeight, documentHeight: Math.max(innerHeight, document.documentElement.scrollHeight, document.body?.scrollHeight || 0) };
  }
  const contextKey = c => JSON.stringify(c);
  const dayKey = time => Math.floor((time + 7 * 3600000) / DAY);
  const entryCount = () => queue.size + (pending?.entries.length || 0);
  function save() {
    if (!cfg.consent || optedOut()) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ pending, queue: [...queue], dropped, unsupportedGeometry })); } catch { /* Memory retry still works if browser storage is unavailable. */ }
  }
  function clear() {
    active = false; queue.clear(); pending = null; segment = null; viewSegment = null; pointers.clear(); requestAbort?.abort();
    clearInterval(timer); timer = null;
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
  }
  function prune() {
    const cutoff = Date.now() - MAX_AGE;
    for (const [key, item] of queue) if (item.entry.timestamp < cutoff) { dropped += item.entry.count; queue.delete(key); }
    if (pending && pending.entries.some(e => e.timestamp < cutoff)) { dropped += pending.entries.reduce((n, e) => n + e.count, 0); pending = null; }
  }
  function restore() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (!saved) return;
      // Only restore this collector's same-tab state, without identifiers for a person/session.
      if (Array.isArray(saved.queue) && saved.queue.length <= LIMIT) queue = new Map(saved.queue);
      if (saved.pending?.schemaVersion === 1 && saved.pending.siteKey === cfg.siteKey && saved.pending.sampleRate === cfg.sampleRate && Array.isArray(saved.pending.entries) && saved.pending.entries.length <= 100) pending = saved.pending;
      dropped = Number.isSafeInteger(saved.dropped) && saved.dropped >= 0 ? saved.dropped : 0;
      unsupportedGeometry = Number.isSafeInteger(saved.unsupportedGeometry) && saved.unsupportedGeometry >= 0 ? saved.unsupportedGeometry : 0;
      prune();
    } catch { queue = new Map(); pending = null; }
  }
  function enqueue(c, entry, identity) {
    prune();
    const key = `${contextKey(c)}|${dayKey(entry.timestamp)}|${identity}`;
    const existing = queue.get(key);
    if (existing && existing.entry.count < 10000) existing.entry.count++;
    else if (entryCount() < LIMIT) queue.set(existing ? `${key}|${entry.timestamp}` : key, { context: c, entry });
    else dropped += entry.count;
    save();
  }
  function sync() {
    if (!cfg.consent || optedOut()) { clear(); return false; }
    if (!validConfig || sampled === false || !allowed(location.pathname)) { active = false; pointers.clear(); segment = null; viewSegment = null; return false; }
    active = true;
    const c = context(), next = contextKey(c);
    if (c.viewportWidth < 100 || c.viewportWidth > 10000 || c.viewportHeight < 100 || c.viewportHeight > 10000 || c.documentHeight < 100 || c.documentHeight > 200000) { active = false; segment = null; pointers.clear(); return false; }
    // Geometry partitions taps and cancels stale gestures, but height changes are not another view.
    segment = next;
    const nextView = JSON.stringify([c.pagePath, c.viewportWidth]);
    if (nextView !== viewSegment) {
      viewSegment = nextView;
      enqueue(c, { type: 'pageview', timestamp: Date.now(), count: 1 }, 'pageview');
    }
    return true;
  }
  function setConsent(value) {
    cfg.consent = value === true;
    if (!cfg.consent || optedOut()) { clear(); return; }
    if (!validConfig) return;
    if (!timer) restore();
    // Preserve selection while recovering a consented unsent batch; a reload must not resample it away.
    if (sampled === null) sampled = Boolean(pending || queue.size) || Math.random() < cfg.sampleRate;
    if (sampled === false) return;
    if (!timer) timer = setInterval(() => { sync(); void flush(); }, 10000);
    sync();
  }
  function structuralKey(el) {
    const parts = [];
    for (let node = el; node && parts.length < 12; node = node.parentElement) {
      let index = 1;
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.tagName === node.tagName) index++;
      parts.push(`${node.tagName.toLowerCase()}:${index}`);
    }
    let hash = 2166136261;
    for (const char of parts.join('/')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return `structural:${(hash >>> 0).toString(16)}`;
  }
  function anchored(target) { return target.closest('[data-track-key],button,a,[role="button"],summary') || target; }
  function fixedPlane(el) {
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      // Sticky has a changing viewport/document relationship; keep it on a separate plane.
      if (style.position === 'fixed' || style.position === 'sticky') return true;
    }
    return false;
  }
  document.addEventListener('pointerdown', e => {
    if (!sync() || !e.isTrusted || !e.isPrimary || e.button !== 0 || !(e.target instanceof Element) || e.target.closest(PRIVATE)) return;
    pointers.set(e.pointerId, { el: anchored(e.target), x: e.clientX, y: e.clientY, scrollX, scrollY, time: Date.now(), segment, moved: false });
  }, true);
  document.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) p.moved = true;
  }, { capture: true, passive: true });
  document.addEventListener('pointercancel', e => pointers.delete(e.pointerId), true);
  document.addEventListener('pointerup', e => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (!p || !sync() || p.segment !== segment || p.moved || !e.isTrusted || !e.isPrimary || e.button !== 0 || Date.now() - p.time > 1000 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8 || scrollX !== p.scrollX || scrollY !== p.scrollY || !(e.target instanceof Element) || e.target.closest(PRIVATE) || !p.el.isConnected || !p.el.contains(e.target)) return;
    const rect = p.el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0) || e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const c = context(), fixed = fixedPlane(p.el), ox = fixed ? 0 : scrollX, oy = fixed ? 0 : scrollY;
    const x = e.clientX + ox, y = e.clientY + oy;
    if (x < 0 || y < 0) return;
    // v1 has no documentWidth field; do not relabel/clamp horizontal overflow as a viewport point.
    if (x >= c.viewportWidth || y >= (fixed ? c.viewportHeight : c.documentHeight) || rect.width > 200000 || rect.height > 200000 || Math.abs(rect.left + ox) > 200000 || Math.abs(rect.top + oy) > 200000) { dropped++; unsupportedGeometry++; save(); return; }
    const explicit = p.el.getAttribute('data-track-key'), region = p.el.closest('[data-track-region]')?.getAttribute('data-track-region');
    const entry = { type: 'tap', timestamp: Date.now(), count: 1, x, y, elementKey: KEY.test(explicit || '') ? explicit : structuralKey(p.el), region: KEY.test(region || '') ? region : 'unmarked', anchorQuality: KEY.test(explicit || '') ? 'explicit' : 'structural', elementU: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), elementV: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)), elementRect: { x: rect.left + ox, y: rect.top + oy, width: rect.width, height: rect.height }, fixed, pointerType: ['mouse', 'touch', 'pen'].includes(e.pointerType) ? e.pointerType : 'mouse' };
    const identity = JSON.stringify([Math.floor(x / 20), Math.floor(y / 20), Math.floor(x / c.viewportWidth * 12) + 1, Math.floor(y / 50) + 1, entry.elementKey, entry.region, entry.anchorQuality, Math.min(19, Math.floor(entry.elementU * 20)), Math.min(19, Math.floor(entry.elementV * 20)), fixed, entry.pointerType, entry.elementRect]);
    enqueue(c, entry, identity);
  }, true);
  // Scroll events include nested scroll containers, which must also cancel a gesture.
  window.addEventListener('scroll', () => pointers.clear(), { capture: true, passive: true });
  async function flush() {
    if (sending) return sending;
    if (!cfg.consent || optedOut()) { clear(); return false; }
    if (!validConfig || sampled === false) return false;
    prune();
    if (!pending) {
      const first = queue.values().next().value;
      if (!first) return true;
      pending = { schemaVersion: 1, siteKey: cfg.siteKey, batchId: crypto.randomUUID(), consent: true, sampleRate: cfg.sampleRate, context: first.context, entries: [] };
      for (const [key, item] of queue) {
        if (contextKey(item.context) !== contextKey(first.context)) continue;
        pending.entries.push(item.entry);
        if (new TextEncoder().encode(JSON.stringify(pending)).length > 60000) { pending.entries.pop(); break; }
        queue.delete(key);
        if (pending.entries.length === 100) break;
      }
      save();
    }
    const batch = pending, body = JSON.stringify(batch);
    sending = (async () => {
      let timeout;
      try {
        const abort = new AbortController(); requestAbort = abort; timeout = setTimeout(() => abort.abort(), 15000);
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'omit', keepalive: true, signal: abort.signal });
        if (!response.ok) { lastError = `HTTP ${response.status}`; return false; }
        if (pending === batch) pending = null;
        lastError = null; save(); return true;
      } catch (error) { lastError = error.name === 'AbortError' ? 'timeout' : 'network'; return false; }
      finally { clearTimeout(timeout); sending = null; requestAbort = null; }
    })();
    return sending;
  }
  window.addEventListener('resize', () => { pointers.clear(); sync(); });
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) { const result = original.apply(this, args); sync(); return result; };
  }
  window.addEventListener('pagehide', () => { save(); void flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); void flush(); } });
  window.dunnioTouch = { setConsent, flush, getState: () => ({ active: active && cfg.consent && !optedOut() && allowed(location.pathname), consent: cfg.consent, sampled, configValid: Boolean(validConfig), queued: entryCount(), queuedCount: [...queue.values()].reduce((n, item) => n + item.entry.count, 0) + (pending?.entries.reduce((n, e) => n + e.count, 0) || 0), pendingBatchId: pending?.batchId || null, droppedCount: dropped, unsupportedGeometryCount: unsupportedGeometry, lastError }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { if (cfg.consent) setConsent(true); }, { once: true });
  else if (cfg.consent) setConsent(true);
})();
