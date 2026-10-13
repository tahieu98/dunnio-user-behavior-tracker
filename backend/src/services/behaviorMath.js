'use strict';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[a-zA-Z0-9_.:-]{1,80}$/;
function invalid(message) { const e = new Error(message); e.statusCode = 400; throw e; }
function cleanPath(value) {
 if (typeof value !== 'string' || value.length > 255 || !value.startsWith('/') || value.startsWith('//') || /[?#\\\s\u0000-\u001f]/.test(value)) invalid('Invalid page path; queries and fragments are not collected');
 // Never ingest sensitive account, checkout, or search routes.
 let decoded;try{decoded=decodeURIComponent(value);}catch{invalid('Invalid encoded path');}
 if (/(^|\/)(checkout|cart|account|my-account|wp-admin|admin|user|login|search)(\/|$)/i.test(decoded)) invalid('Sensitive route excluded');
 return value;
}
function monthBounds(month) {
 if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month || '')) invalid('Month must use YYYY-MM');
 const [year, m] = month.split('-').map(Number);
 // Reporting timezone is Asia/Ho_Chi_Minh (UTC+07, no DST).
 const start = new Date(Date.UTC(year,m-1,1,-7));
 const end = new Date(Date.UTC(year,m,1,-7));
 return { month, start, end, timezone:'Asia/Ho_Chi_Minh' };
}

/**
 * Parse a YYYY-MM-DD date string into a UTC-7 Date.
 * Reports are calculated in Asia/Ho_Chi_Minh (UTC+07:00, no DST).
 */
function dayBounds(startDate, endDate) {
 const START_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
 if (!START_RE.test(startDate || '')) invalid('startDate must use YYYY-MM-DD');
 if (!START_RE.test(endDate || '')) invalid('endDate must use YYYY-MM-DD');
 for(const value of [startDate,endDate]){const calendar=new Date(value+'T00:00:00Z');if(!Number.isFinite(+calendar)||calendar.toISOString().slice(0,10)!==value)invalid('Invalid calendar date');}
 const [sy, sm, sd] = startDate.split('-').map(Number);
 const [ey, em, ed] = endDate.split('-').map(Number);
 const start = new Date(Date.UTC(sy, sm-1, sd, -7));
 const end   = new Date(Date.UTC(ey, em-1, ed+1, -7)); // exclusive upper bound
 // Sanity: end must be after start and range ≤ 366 days
 if (end <= start) invalid('endDate must be after startDate');
 const days = (end - start) / 86400000;
 if (days > 366) invalid('Date range must not exceed 366 days');
 return { start, end, timezone:'Asia/Ho_Chi_Minh' };
}
function toGrid(x,y,width) { return { col: Math.min(12,Math.floor(x / width * 12)+1), row: Math.floor(y / 50)+1 }; }
function validateBatch(input, now = Date.now()) {
 if (!input || input.consent !== true) invalid('Analytics consent required');
 if (!KEY.test(input.siteKey || '') || !UUID.test(input.sessionId || '')) invalid('Invalid site or session');
 if (!Array.isArray(input.events) || !input.events.length || input.events.length > 50) invalid('Batch must contain 1–50 events');
 return input.events.map(e => {
  if (!e || !UUID.test(e.id || '') || !UUID.test(e.viewId || '') || !['pageview','click','scroll','exposure','action'].includes(e.type)) invalid('Invalid event identity/type');
  if (!Number.isFinite(e.timestamp) || e.timestamp > now + 300000 || e.timestamp < now - 86400000) invalid('Event outside 24-hour ingestion window');
  if (!KEY.test(e.layoutVersion || '') || !['desktop','tablet','mobile'].includes(e.device)) invalid('Invalid layout/device');
  for (const k of ['viewportWidth','viewportHeight','documentHeight']) if (!Number.isInteger(e[k]) || e[k] < 100 || e[k] > (k === 'documentHeight' ? 200000 : 10000)) invalid('Invalid dimensions');
  const result = { id:e.id, viewId:e.viewId, type:e.type, timestamp:e.timestamp, pagePath:cleanPath(e.pagePath), device:e.device, layoutVersion:e.layoutVersion, viewportWidth:e.viewportWidth, viewportHeight:e.viewportHeight, documentHeight:e.documentHeight, region:KEY.test(e.region || '') ? e.region : 'unmarked', elementKey:KEY.test(e.elementKey || '') ? e.elementKey : null, targetPath:e.targetPath ? cleanPath(e.targetPath) : null, actionName:null, sourceEventId:null, scrollDepth:null, x:null, y:null, col:null, row:null };
  if (e.type === 'click' || e.type === 'exposure') {
   if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || e.x < 0 || e.x >= e.viewportWidth || e.y < 0 || e.y >= e.documentHeight) invalid('Coordinates outside document');
   Object.assign(result,{x:e.x,y:e.y,...toGrid(e.x,e.y,e.viewportWidth)});
  }
  if (e.type === 'scroll') {
   if (![25,50,75,100].includes(e.scrollDepth)) invalid('Invalid scroll milestone');
   result.scrollDepth=e.scrollDepth;
  }
  if (e.type === 'action') {
   if (!['navigation','form_success','customizer_start'].includes(e.actionName) || !UUID.test(e.sourceEventId || '')) invalid('Action requires a supported name and source click');
   result.actionName=e.actionName; result.sourceEventId=e.sourceEventId;
   if (e.actionName === 'navigation' && !result.targetPath) invalid('Navigation requires destination path');
  }
  return result;
 });
}
function summarize(events, month, device, version, width) {
 const bounds=monthBounds(month);
 const rows=events.filter(e=>new Date(e.occurred_at)>=bounds.start && new Date(e.occurred_at)<bounds.end && e.device===device && e.layout_version===version && (!width || e.viewport_width===width));
 const clicks=rows.filter(e=>e.event_type==='click');
 const allById=new Map(events.map(e=>[e.event_id,e]));
 const confirms=e=>{const c=allById.get(e.source_event_id);const delay=new Date(e.occurred_at)-new Date(c?.occurred_at);return e.event_type==='action'&&c?.event_type==='click'&&c.site_id===e.site_id&&c.session_hash===e.session_hash&&c.device===e.device&&c.layout_version===e.layout_version&&c.view_id===e.view_id&&c.viewport_width===e.viewport_width&&c.page_path===e.page_path&&delay>=0&&delay<=1800000;};
 const confirmed=new Set(events.filter(confirms).map(e=>e.source_event_id));
 const cells=new Map(),regions=new Map();
 const summary={pageviews:rows.filter(e=>e.event_type==='pageview').length,sessions:new Set(rows.map(e=>e.session_hash)).size,clicks:clicks.length,actions:0};
 for (const e of clicks) {
  const key=`${e.grid_col}:${e.grid_row}`;
  if (!cells.has(key)) cells.set(key,{col:e.grid_col,row:e.grid_row,clicks:0,actions:0,elements:new Set(),regions:new Set()});
  if (!regions.has(e.region_key)) regions.set(e.region_key,{key:e.region_key,clicks:0,actions:0,exposures:0});
  const c=cells.get(key),r=regions.get(e.region_key),a=confirmed.has(e.event_id)?1:0;
  c.clicks++; c.actions+=a; if(e.element_key)c.elements.add(e.element_key); c.regions.add(e.region_key);
  r.clicks++;r.actions+=a;summary.actions+=a;
 }
 for (const e of rows.filter(e=>e.event_type==='exposure')) {
  if(!regions.has(e.region_key))regions.set(e.region_key,{key:e.region_key,clicks:0,actions:0,exposures:0});
  regions.get(e.region_key).exposures++;
 }
 const rate=(n,d)=>d?Math.round(n/d*10000)/100:null;
 summary.clicksPer100Views=rate(summary.clicks,summary.pageviews); summary.actionRate=rate(summary.actions,summary.clicks);
 const clickIds=new Set(clicks.map(c=>c.event_id));
 const outcomes=events.filter(e=>confirms(e)&&clickIds.has(e.source_event_id)).map(e=>{const c=allById.get(e.source_event_id);return {col:c.grid_col,row:c.grid_row,name:e.action_name,targetPath:e.target_path||null,count:1};});
 const times=rows.map(e=>e.occurred_at).sort();
 return {month,summary,cells:[...cells.values()].map(c=>({...c,elements:[...c.elements],regions:[...c.regions],per100Views:rate(c.clicks,summary.pageviews),actionRate:rate(c.actions,c.clicks)})),regions:[...regions.values()].map(r=>({...r,per100Views:rate(r.clicks,summary.pageviews),actionRate:rate(r.actions,r.clicks)})),scroll:[25,50,75,100].map(depth=>({depth,views:new Set(rows.filter(e=>e.event_type==='scroll'&&e.scroll_depth===depth).map(e=>e.view_id)).size})),outcomes,coverage:{first:times[0]||null,last:times.at(-1)||null},lowSample:summary.pageviews<100};
}
function compare(a,b) {
 const keys=new Set([...a.cells,...b.cells].map(c=>`${c.col}:${c.row}`));
 const am=new Map(a.cells.map(c=>[`${c.col}:${c.row}`,c])),bm=new Map(b.cells.map(c=>[`${c.col}:${c.row}`,c]));
 return [...keys].map(key=>{const [col,row]=key.split(':').map(Number);const x=am.get(key),y=bm.get(key);const av=x?.clicks||0,bv=y?.clicks||0;return {col,row,a:av,b:bv,delta:av-bv,deltaPercent:bv?Math.round((av-bv)/bv*10000)/100:null,rateDelta:a.summary.pageviews&&b.summary.pageviews?Math.round(((x?.per100Views||0)-(y?.per100Views||0))*100)/100:null};});
}
module.exports={validateBatch,cleanPath,monthBounds,dayBounds,toGrid,summarize,compare,invalid};
