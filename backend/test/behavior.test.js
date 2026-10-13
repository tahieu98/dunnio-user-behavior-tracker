const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const {monthBounds,toGrid,cleanPath,validateBatch,summarize,compare}=require('../src/services/behaviorMath');
const base=()=>({id:crypto.randomUUID(),viewId:crypto.randomUUID(),type:'click',timestamp:Date.now(),pagePath:'/blog/example.html',device:'desktop',layoutVersion:'v1',viewportWidth:1440,viewportHeight:900,documentHeight:12000,x:120,y:500,elementText:'Must never persist'});
const batch=e=>({siteKey:'dunnio-public-v1',sessionId:crypto.randomUUID(),consent:true,events:[e]});
test('calendar months use Vietnam boundaries, including year changes',()=>{
 assert.equal(monthBounds('2026-09').start.toISOString(),'2026-08-31T17:00:00.000Z');
 assert.equal(monthBounds('2026-12').end.toISOString(),'2026-12-31T17:00:00.000Z');
 assert.throws(()=>monthBounds('2026-13'));assert.throws(()=>monthBounds('2026-9'));
});
test('coordinates use exact 50px half-open cells without clipping long pages',()=>{
 assert.deepEqual(toGrid(0,0,1440),{col:1,row:1});assert.deepEqual(toGrid(120,500,1440),{col:2,row:11});assert.deepEqual(toGrid(1439,50000,1440),{col:12,row:1001});
});
test('sanitizer enforces consent, dates and dimensions, drops text and all unlisted fields',()=>{
 const e=base(),result=validateBatch(batch(e))[0];assert.equal(result.elementText,undefined);assert.equal(result.col,2);
 assert.throws(()=>validateBatch({...batch(e),consent:false}));assert.throws(()=>validateBatch(batch({...e,x:1440})));assert.throws(()=>validateBatch(batch({...e,timestamp:Date.now()-86400001})));
 assert.throws(()=>validateBatch(batch({...e,type:'action',actionName:'navigation'})));
});
test('PII-bearing URLs, sensitive routes and protocol-relative paths are rejected',()=>{
 for(const p of ['/blog/a?email=a','//evil.com','/checkout','/account/name','/search','/blog/a#x'])assert.throws(()=>cleanPath(p));assert.equal(cleanPath('/blog/suit.html'),'/blog/suit.html');
});
test('click-normalized comparisons preserve zero baselines and device/layout boundaries',()=>{
 const common={device:'desktop',layout_version:'v1',session_hash:'s',view_id:'view',viewport_width:1440,page_path:'/blog/example.html'};
 const click={...common,event_id:'c',event_type:'click',occurred_at:'2026-09-30T16:59:00Z',grid_col:2,grid_row:10,region_key:'cta'};
 const raw=[{...common,event_id:'v',event_type:'pageview',occurred_at:'2026-08-31T17:00:00Z'},click,{...click,event_id:'a',event_type:'action',occurred_at:'2026-09-30T17:05:00Z',source_event_id:'c',action_name:'navigation'},{...click,event_id:'a2',event_type:'action',occurred_at:'2026-09-30T17:06:00Z',source_event_id:'c',action_name:'navigation'}];
 const a=summarize(raw,'2026-09','desktop','v1',1440),b=summarize(raw,'2026-08','desktop','v1',1440);
 assert.equal(a.summary.pageviews,1);assert.equal(a.summary.actions,1);assert.equal(a.summary.actionRate,100);assert.equal(compare(a,b)[0].deltaPercent,null);assert.equal(b.summary.actionRate,null);assert.equal(summarize(raw,'2026-09','mobile','v1',390).summary.clicks,0);
});
test('attribution ignores late actions and mismatching view/site contexts',()=>{
 const click={event_id:'c',event_type:'click',occurred_at:'2026-09-01T00:00:00Z',device:'desktop',layout_version:'v1',session_hash:'s',view_id:'v',viewport_width:1440,grid_col:2,grid_row:10,region_key:'cta'};
 const raw=[click,{...click,event_id:'late',event_type:'action',occurred_at:'2026-09-01T01:00:00Z',source_event_id:'c'},{...click,event_id:'wrongview',event_type:'action',source_event_id:'c',view_id:'other'}];
 assert.equal(summarize(raw,'2026-09','desktop','v1',1440).summary.actions,0);
});
