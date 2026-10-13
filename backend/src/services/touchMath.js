'use strict';
const crypto=require('crypto');
const {cleanPath:legacyCleanPath,invalid}=require('./behaviorMath');
const KEY=/^[a-zA-Z0-9_.:-]{1,80}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY=86400000;
function cleanPath(value){
 legacyCleanPath(value);
 const decoded=decodeURIComponent(value);
 if(/[?#\\\s\u0000-\u001f<>]/.test(decoded)||decoded.startsWith('//')||/(^|\/)(checkout|cart|account|my-account|wp-admin|admin|user|users|login|logout|signin|signup|auth|search|payment|billing|profile|register|api)(\/|$)/i.test(decoded))invalid('Private route excluded from first-party collection');
 return value;
}
function collectorLimit(value){
 if(value===undefined||value==='')return 120;
 if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isInteger(Number(value))||Number(value)<1||Number(value)>6000)throw new Error('TOUCH_INGEST_LIMIT must be an integer from 1 to 6000');
 return Number(value);
}
function calendar(value){
 if(typeof value!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))invalid('Date must use YYYY-MM-DD');
 const [y,m,d]=value.split('-').map(Number),t=Date.UTC(y,m-1,d);
 if(new Date(t).toISOString().slice(0,10)!==value)invalid('Date must be a real calendar day');
 return t;
}
function dayBounds(start,end){const a=calendar(start),b=calendar(end);if(b<a||(b-a)/DAY+1>366)invalid('Period must contain 1–366 days');return {start:new Date(a-7*3600000),end:new Date(b+DAY-7*3600000)};}
function eventDate(timestamp){return new Date(timestamp+7*3600000).toISOString().slice(0,10);}
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
const hash=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');
function validateBatch(input,now=Date.now()){
 if(!input||input.consent!==true)invalid('Analytics consent required');
 if(input.schemaVersion!==1||!KEY.test(input.siteKey||'')||!UUID.test(input.batchId||''))invalid('Invalid schema/site/batch');
 if(!Number.isFinite(input.sampleRate)||input.sampleRate<0.000001||input.sampleRate>1||Number(input.sampleRate.toFixed(6))!==input.sampleRate)invalid('sampleRate must be 0.000001–1 with at most 6 decimal places');
 const c=input.context;if(!c||!KEY.test(c.layoutVersion||'')||!['desktop','tablet','mobile'].includes(c.device))invalid('Invalid context');
 for(const k of ['viewportWidth','viewportHeight','documentHeight'])if(!Number.isInteger(c[k])||c[k]<100||c[k]>(k==='documentHeight'?200000:10000))invalid('Invalid dimensions');
 const context={pagePath:cleanPath(c.pagePath),layoutVersion:c.layoutVersion,device:c.device,viewportWidth:c.viewportWidth,viewportHeight:c.viewportHeight,documentHeight:c.documentHeight};
 if(!Array.isArray(input.entries)||!input.entries.length||input.entries.length>100)invalid('Batch must contain 1–100 entries');
 const entries=input.entries.map(e=>{
  if(!e||!['pageview','tap'].includes(e.type)||!Number.isInteger(e.count)||e.count<1||e.count>10000)invalid('Invalid entry type/count');
  if(!Number.isSafeInteger(e.timestamp)||e.timestamp<now-DAY||e.timestamp>now+300000)invalid('Entry outside 24-hour ingestion window');
  const r={type:e.type,timestamp:e.timestamp,count:e.count};if(e.type==='pageview')return r;
  if(typeof e.fixed!=='boolean'||!['mouse','touch','pen'].includes(e.pointerType))invalid('Invalid plane/pointer type');
  // The v1 context has no document width. Reject horizontal overflow rather than clipping into column 12.
  if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.x>=c.viewportWidth||e.y<0||e.y>=(e.fixed?c.viewportHeight:c.documentHeight))invalid('Coordinates outside declared geometry');
  if(!KEY.test(e.elementKey||'')||!KEY.test(e.region||'')||!['explicit','structural'].includes(e.anchorQuality))invalid('Invalid element anchor');
  if(!Number.isFinite(e.elementU)||!Number.isFinite(e.elementV)||e.elementU<0||e.elementU>1||e.elementV<0||e.elementV>1)invalid('Invalid relative anchor');
  const b=e.elementRect;if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.width<=0||b.height<=0||Math.abs(b.x)>200000||Math.abs(b.y)>200000||b.width>200000||b.height>200000)invalid('Invalid element bounds');
  return {...r,x:e.x,y:e.y,elementKey:e.elementKey,region:e.region,anchorQuality:e.anchorQuality,elementU:e.elementU,elementV:e.elementV,elementRect:{x:b.x,y:b.y,width:b.width,height:b.height},fixed:e.fixed,pointerType:e.pointerType};
 });
 const batch={schemaVersion:1,siteKey:input.siteKey,batchId:input.batchId.toLowerCase(),consent:true,sampleRate:input.sampleRate,context,entries};
 // Hash the complete submitted JSON (including ignored fields) so an ID cannot be reused with changed content.
 return {...batch,payloadHash:hash(input)};
}
function reportOptions(input){
 if(!input||!Number.isInteger(input.siteId)||input.siteId<1||!['desktop','tablet','mobile'].includes(input.device)||!KEY.test(input.version||'')||!Number.isInteger(input.width)||input.width<100||input.width>10000)invalid('Select valid site, device, layout and width');
 cleanPath(input.path);if(!Array.isArray(input.periods)||!input.periods.length||input.periods.length>12)invalid('Select 1–12 periods');
 const ids=new Set(),periods=input.periods.map(p=>{if(!p||!KEY.test(p.id||'')||ids.has(p.id)||typeof p.label!=='string'||!p.label.trim()||p.label.length>120||!['A','B'].includes(p.group))invalid('Invalid period identity/label/group');if(p.version!==undefined&&!KEY.test(p.version))invalid('Invalid period layout');if(p.width!==undefined&&(!Number.isInteger(p.width)||p.width<100||p.width>10000))invalid('Invalid period width');ids.add(p.id);dayBounds(p.start,p.end);return {id:p.id,label:p.label,start:p.start,end:p.end,group:p.group,...(p.version!==undefined?{version:p.version}:{}),...(p.width!==undefined?{width:p.width}:{})};});
 const sorted=[...periods].sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<sorted.length;i++)if(sorted[i].start<=sorted[i-1].end)invalid('Periods must not overlap');
 return {siteId:input.siteId,path:input.path,device:input.device,version:input.version,width:input.width,periods};
}
function safeCount(value){const n=Number(value||0);if(!Number.isSafeInteger(n)||n<0){const e=new Error('Aggregate exceeds safe JSON count precision');e.statusCode=422;throw e;}return n;}
const rate=(n,d)=>d?Math.round(n/d*10000)/100:null;
function delta(a,b){return {a,b,delta:a===null||b===null?null:b-a,percent:a===null||b===null||a===0?null:Math.round((b-a)/a*10000)/100};}
function compare(periods){
 const groups=['A','B'].map(g=>periods.filter(p=>p.group===g));
 const complete=groups.map(g=>g.length>0&&g.every(p=>p.hasData));
 const heights=periods.filter(p=>p.hasData).flatMap(p=>[p.geometry.minHeight,p.geometry.maxHeight]);
 const geometryComparable=complete.every(Boolean)&&heights.length>0&&heights.every(h=>h!==null&&h===heights[0])&&periods.every(p=>!p.geometry.minViewportHeight||p.geometry.minViewportHeight===p.geometry.maxViewportHeight)&&new Set(periods.filter(p=>p.hasData).map(p=>p.geometry.minViewportHeight)).size<=1&&new Set(periods.map(p=>p.version)).size<=1&&new Set(periods.map(p=>p.width)).size<=1;
 const warnings=[];if(!complete.every(Boolean))warnings.push('Một nhóm có kỳ thiếu dữ liệu; delta không được tính.');if(!geometryComparable)warnings.push('Geometry khác nhau hoặc thiếu; không so sánh ô và vị trí.');
 if(periods.some(p=>p.sampleRates?.some(s=>s!==1)))warnings.push('Dữ liệu có sampling; counts là số nhận được, không được ngoại suy.');
 const totals=groups.map((g,i)=>complete[i]?safeCount(g.reduce((s,p)=>s+p.summary.taps,0)):null),views=groups.map((g,i)=>complete[i]?safeCount(g.reduce((s,p)=>s+p.summary.pageviews,0)):null);
 const gather=(g,field,key)=>{const m=new Map();for(const p of g)for(const v of p[field]){const k=key(v),old=m.get(k)||{...v,count:0,sumX:0,sumY:0,explicit:true,planes:0};old.count=safeCount(old.count+v.count);if(field==='elements'){old.sumX+=v.centroidX*v.count;old.sumY+=v.centroidY*v.count;old.explicit&&=v.anchorQuality==='explicit';old.planes|=v.fixed?2:1;}m.set(k,old);}return m;};
 const cm=groups.map(g=>gather(g,'cells',v=>`${v.col}:${v.row}`)),em=groups.map(g=>gather(g,'elements',v=>v.elementKey));
 const cells=geometryComparable?[...new Set([...cm[0].keys(),...cm[1].keys()])].sort().map(k=>{const [col,row]=k.split(':').map(Number),a=cm[0].get(k)?.count||0,b=cm[1].get(k)?.count||0;return {col,row,...delta(a,b),rateA:rate(a,views[0]),rateB:rate(b,views[1])};}):[];
 const elements=[...new Set([...em[0].keys(),...em[1].keys()])].sort().map(k=>{const a=em[0].get(k),b=em[1].get(k),positionComparable=geometryComparable&&!!a&&!!b&&a.planes===b.planes&&a.planes!==3;const structural=!((a?.explicit??true)&&(b?.explicit??true));return {elementKey:k,...delta(complete[0]&&(!structural||geometryComparable)?a?.count||0:null,complete[1]&&(!structural||geometryComparable)?b?.count||0:null),positionA:complete[0]&&a&&a.planes!==3?{x:a.sumX/a.count,y:a.sumY/a.count}:null,positionB:complete[1]&&b&&b.planes!==3?{x:b.sumX/b.count,y:b.sumY/b.count}:null,positionComparable,anchorQuality:structural?'structural':'explicit'};});
 if(elements.some(e=>e.anchorQuality==='structural'))warnings.push('Structural keys không chứng minh cùng nội dung qua thay đổi layout.');
 return {cells,elements,summary:{...delta(...totals),pageviewsA:views[0],pageviewsB:views[1],rateA:views[0]!==null?rate(totals[0],views[0]):null,rateB:views[1]!==null?rate(totals[1],views[1]):null},geometryComparable,warnings};
}
module.exports={cleanPath,collectorLimit,calendar,dayBounds,eventDate,canonical,hash,validateBatch,reportOptions,safeCount,rate,delta,compare,invalid};
