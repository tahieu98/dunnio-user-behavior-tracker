'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const m=require('../src/services/touchMath');
const {aggregate,representative}=require('../src/services/touchStore');
const now=Date.UTC(2026,9,11,3);
const tap=(changes={})=>({type:'tap',timestamp:now,count:3,x:180,y:950,elementKey:'guide-image',region:'article',anchorQuality:'explicit',elementU:.45,elementV:.35,elementRect:{x:40,y:800,width:300,height:500},fixed:false,pointerType:'touch',...changes});
const batch=(changes={})=>({schemaVersion:1,siteKey:'public-key',batchId:crypto.randomUUID(),consent:true,sampleRate:1,context:{pagePath:'/article',layoutVersion:'release-1',device:'mobile',viewportWidth:390,viewportHeight:844,documentHeight:5000},entries:[{type:'pageview',timestamp:now,count:1},tap()],...changes});
test('real calendar dates and closed UTC+07 ranges, including leap days and year boundaries',()=>{
 for(const d of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-2-01','2026-01-32','2026-10-11T00:00:00Z'])assert.throws(()=>m.calendar(d));
 assert.equal(m.dayBounds('2024-02-29','2024-02-29').start.toISOString(),'2024-02-28T17:00:00.000Z');
 assert.equal(m.dayBounds('2026-12-31','2026-12-31').end.toISOString(),'2026-12-31T17:00:00.000Z');
 assert.throws(()=>m.dayBounds('2026-01-02','2026-01-01'));assert.throws(()=>m.dayBounds('2024-01-01','2025-01-01'));
 assert.doesNotThrow(()=>m.dayBounds('2024-01-01','2024-12-31'));
 assert.equal(m.eventDate(Date.parse('2026-10-10T16:59:59Z')),'2026-10-10');assert.equal(m.eventDate(Date.parse('2026-10-10T17:00:00Z')),'2026-10-11');
});
test('batch consent, schema, limits, time window and dimensions are strict',()=>{
 for(const change of [{consent:false},{consent:undefined},{schemaVersion:2},{batchId:'bad'},{sampleRate:0},{sampleRate:1.01},{sampleRate:.0000001},{entries:[]},{entries:Array(101).fill(tap())}])assert.throws(()=>m.validateBatch(batch(change),now));
 for(const e of [tap({count:0}),tap({count:1.5}),tap({count:10001}),tap({timestamp:now-86400001}),tap({timestamp:now+300001}),tap({type:'click'})])assert.throws(()=>m.validateBatch(batch({entries:[e]}),now));
 assert.doesNotThrow(()=>m.validateBatch(batch({entries:[tap({timestamp:now-86400000,count:10000}),tap({timestamp:now+300000})]}),now));
 assert.throws(()=>m.validateBatch(batch({context:{...batch().context,viewportWidth:'390'}}),now));
 for(const pagePath of ['/account','/checkout','/blog?q=private','/search','/%61ccount','//evil.invalid'])assert.throws(()=>m.validateBatch(batch({context:{...batch().context,pagePath}}),now));
});
test('validates coordinates, separates fixed plane, and retains privacy-safe relative anchors',()=>{
 for(const e of [tap({x:390}),tap({x:-1}),tap({y:5000}),tap({fixed:true,y:844}),tap({elementU:1.1}),tap({elementV:-.1}),tap({elementKey:'email@example.com'}),tap({anchorQuality:'text'}),tap({fixed:undefined}),tap({pointerType:'click'}),tap({elementRect:{x:0,y:0,width:0,height:100}})])assert.throws(()=>m.validateBatch(batch({entries:[e]}),now));
 const b=m.validateBatch(batch({entries:[tap({fixed:true,y:800,elementU:1,elementV:0,elementText:'private',href:'?email=private'})]}),now);
 assert.equal(b.entries[0].fixed,true);assert.equal(b.entries[0].elementText,undefined);assert.equal(b.entries[0].href,undefined);
});
test('canonical receipt SHA ignores object property order but detects every payload mutation',()=>{
 const b=batch(),same={entries:b.entries,context:b.context,sampleRate:b.sampleRate,consent:b.consent,batchId:b.batchId,siteKey:b.siteKey,schemaVersion:b.schemaVersion};
 assert.equal(m.validateBatch(b,now).payloadHash,m.validateBatch(same,now).payloadHash);
 assert.notEqual(m.validateBatch(b,now).payloadHash,m.validateBatch({...b,extra:'changed'},now).payloadHash);
 assert.notEqual(m.validateBatch(b,now).payloadHash,m.validateBatch({...b,entries:[...b.entries].reverse()},now).payloadHash);
});
test('sampleRate preserves valid six-digit decimal values despite binary float products',()=>{
 for(const sampleRate of [.000123,.000249,.016003,.123457,.500001,.999999])assert.equal(m.validateBatch(batch({sampleRate}),now).sampleRate,sampleRate);
 assert.throws(()=>m.validateBatch(batch({sampleRate:.1234567}),now));
});
test('first-party private routes match the SDK boundary for plain and encoded paths without changing legacy behavior',()=>{
 const denied=['checkout','cart','account','my-account','wp-admin','admin','user','users','login','logout','signin','signup','auth','search','payment','billing','profile','register','api'];
 for(const segment of denied)for(const path of [`/${segment}`,`/public/${segment}/details`,`/%${segment.charCodeAt(0).toString(16)}${segment.slice(1)}/callback`]){
  assert.throws(()=>m.validateBatch(batch({context:{...batch().context,pagePath:path}}),now));
  assert.throws(()=>m.reportOptions({...options(),path}));
 }
 for(const path of ['/article/%00','/article/%0a','/article/%3femail=private','/article/%5caccount','/%2fexample.invalid'])assert.throws(()=>m.cleanPath(path));
 assert.equal(m.cleanPath('/blog/profile-guide'),'/blog/profile-guide');
 assert.equal(require('../src/services/behaviorMath').cleanPath('/users/profile'),'/users/profile');
});
test('collector limiter accepts an explicit benchmark ceiling and rejects invalid startup configuration',()=>{
 assert.equal(m.collectorLimit(undefined),120);assert.equal(m.collectorLimit(''),120);assert.equal(m.collectorLimit('1'),1);assert.equal(m.collectorLimit('6000'),6000);
 for(const v of ['0','6001','1.5','-1','NaN','1e3',' 120',120])assert.throws(()=>m.collectorLimit(v),/TOUCH_INGEST_LIMIT/);
 const {spawnSync}=require('node:child_process'),route=require.resolve('../src/routes/touch');
 for(const [limit,expected] of [['6000',0],['6001',1]]){const child=spawnSync(process.execPath,['-e',`require(${JSON.stringify(route)})`],{env:{...process.env,TOUCH_INGEST_LIMIT:limit},encoding:'utf8'});assert.equal(child.status,expected);if(expected)assert.match(child.stderr,/TOUCH_INGEST_LIMIT/);}
});
test('daily counters group by date/geometry/anchor/relative bins and split 20px bins at 50px grid boundaries',()=>{
 const b=m.validateBatch(batch({entries:[{type:'pageview',timestamp:now,count:10},tap({x:180,y:49,count:2}),tap({x:180,y:51,count:4}),tap({x:180,y:51,count:5}),tap({x:180,y:51,fixed:true,count:6})]}),now),a=aggregate(b);
 assert.equal(a.pages.length,1);assert.equal(a.pages[0].pageviews,10);assert.equal(a.pages[0].taps,17);
 assert.equal(a.points.length,3);assert.equal(a.points.find(p=>p.grid_row===2&&!p.fixed).count,9);assert.equal(new Set(a.points.map(p=>p.y_bucket)).size,1);
 assert.equal(a.elements.length,2);assert.equal(a.elements.find(p=>!p.fixed).count,11);assert.equal(a.elements.find(p=>!p.fixed).u_bin,9);assert.equal(a.elements.find(p=>!p.fixed).v_bin,7);assert.equal(a.elements.find(p=>!p.fixed).sum_y,2*49+9*51);
 const midnight=Date.parse('2026-10-10T17:00:00Z');assert.equal(aggregate(m.validateBatch(batch({entries:[tap({timestamp:midnight-1}),tap({timestamp:midnight})]}),now)).pages.length,2);
});
const options=()=>({siteId:1,path:'/article',device:'mobile',version:'v1',width:390,periods:[{id:'a',label:'A',start:'2026-01-01',end:'2026-01-31',group:'A'},{id:'b',label:'B',start:'2026-02-01',end:'2026-02-28',group:'B'}]});
test('report range IDs, overlap and optional period cohort overrides are validated',()=>{
 const o=options();assert.deepEqual(m.reportOptions(o),o);
 for(const periods of [[],Array(13).fill(o.periods[0]),[o.periods[0],{...o.periods[1],id:'a'}],[o.periods[0],{...o.periods[1],start:'2026-01-31'}],[{...o.periods[0],group:'C'}],[{...o.periods[0],width:99}],[{...o.periods[0],version:'bad key'}]])assert.throws(()=>m.reportOptions({...o,periods}));
 assert.equal(m.reportOptions({...o,periods:[{...o.periods[0],version:'v2',width:1280}]}).periods[0].version,'v2');
});
const period=(group,taps,views=10,changes={})=>({group,hasData:true,summary:{taps,pageviews:views},cells:taps?[{col:1,row:2,count:taps}]:[],elements:taps?[{elementKey:'cta',region:'hero',anchorQuality:'explicit',count:taps,centroidX:50,centroidY:70}]:[],geometry:{minHeight:500,maxHeight:500,minViewportHeight:300,maxViewportHeight:300},version:'v1',width:390,sampleRates:[1],...changes});
test('grouped comparison sums counts and denominators with B−A delta and baseline A percent',()=>{
 const c=m.compare([period('A',10,10),period('A',20,30),period('B',60,20),period('B',10,80)]);
 assert.equal(c.summary.a,30);assert.equal(c.summary.b,70);assert.equal(c.summary.delta,40);assert.equal(c.summary.percent,133.33);assert.equal(c.summary.rateA,75);assert.equal(c.summary.rateB,70);assert.equal(c.cells[0].delta,40);
});
test('zero taps with observed pageviews is a zero; missing constituent periods propagate null',()=>{
 const zero=m.compare([period('A',0,15),period('B',3,10)]);assert.equal(zero.summary.a,0);assert.equal(zero.summary.delta,3);assert.equal(zero.summary.percent,null);assert.equal(zero.cells[0].rateA,0);
 const missing=m.compare([period('A',10),period('A',0,0,{hasData:false,geometry:{minHeight:null,maxHeight:null}}),period('B',3)]);assert.equal(missing.summary.a,null);assert.equal(missing.summary.delta,null);assert.equal(missing.elements[0].a,null);assert.deepEqual(missing.cells,[]);
 const absent=m.compare([period('A',10)]);assert.equal(absent.summary.b,null);assert.equal(absent.summary.delta,null);
});
test('geometry/layout mismatch suppresses positional cells but preserves explicit totals and warns on structural keys',()=>{
 for(const change of [{geometry:{minHeight:500,maxHeight:600}},{version:'v2'},{width:1280},{geometry:{minHeight:600,maxHeight:600}},{geometry:{minHeight:500,maxHeight:500,minViewportHeight:400,maxViewportHeight:400}}]){const c=m.compare([period('A',10),period('B',20,10,change)]);assert.equal(c.geometryComparable,false);assert.deepEqual(c.cells,[]);assert.equal(c.elements[0].delta,10);assert.equal(c.elements[0].positionComparable,false);}
 const c=m.compare([period('A',10,10,{elements:[{elementKey:'s:1',count:10,centroidX:2,centroidY:3,anchorQuality:'structural'}]}),period('B',20,10,{version:'v2',elements:[{elementKey:'s:1',count:20,centroidX:2,centroidY:3,anchorQuality:'structural'}],sampleRates:[.5]})]);assert.equal(c.elements[0].delta,null);assert.ok(c.warnings.some(w=>w.includes('Structural')));assert.ok(c.warnings.some(w=>w.includes('sampling')));
});
test('counts reject unsafe JSON precision rather than silently rounding',()=>{assert.equal(m.safeCount('9007199254740991'),Number.MAX_SAFE_INTEGER);assert.throws(()=>m.safeCount('9007199254740992'));assert.throws(()=>m.safeCount('-1'));assert.equal(m.rate(3,0),null);assert.deepEqual(m.delta(0,3),{a:0,b:3,delta:3,percent:null});});
test('one key in both fixed and document planes never receives a combined positional comparison',()=>{
 const mixed=period('A',10,10,{elements:[{elementKey:'cta',count:4,centroidX:40,centroidY:50,anchorQuality:'explicit',fixed:true},{elementKey:'cta',count:6,centroidX:60,centroidY:500,anchorQuality:'explicit',fixed:false}]}),c=m.compare([mixed,{...mixed,group:'B'}]);
 assert.equal(c.elements[0].a,10);assert.equal(c.elements[0].b,10);assert.equal(c.elements[0].delta,0);assert.equal(c.elements[0].positionComparable,false);assert.equal(c.elements[0].positionA,null);assert.equal(c.elements[0].positionB,null);
 const same=m.compare([period('A',3,10,{elements:[{elementKey:'cta',count:3,centroidX:40,centroidY:50,anchorQuality:'explicit',fixed:true}]}),period('B',4,10,{elements:[{elementKey:'cta',count:4,centroidX:60,centroidY:60,anchorQuality:'explicit',fixed:true}]})]);assert.equal(same.elements[0].positionComparable,true);
});
test('representative coordinates stay inside both 20px buckets and the counted grid cell',()=>{
 const b=m.validateBatch(batch({entries:[tap({x:32.49,y:49}),tap({x:32.51,y:51}),tap({x:389.99,y:4999.99})]}),now);
 for(const p of aggregate(b).points){const point=representative(p,390);assert.equal(Math.floor(point.x/390*12)+1,p.grid_col);assert.equal(Math.floor(point.y/50)+1,p.grid_row);assert.equal(Math.floor(point.x/20),p.x_bucket);assert.equal(Math.floor(point.y/20),p.y_bucket);}
});
