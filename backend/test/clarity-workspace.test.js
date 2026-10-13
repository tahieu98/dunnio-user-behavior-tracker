'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const math=require('../src/services/clarityHeatmapMath');
const report=(id,month,count,extra={})=>({id,site_id:1,page_path:'/article',project_id:'test-project',device:'mobile',heatmap_type:'all-clicks',segment:'',timezone:'Asia/Ho_Chi_Minh',start_date:`2026-${month}-01`,end_date:`2026-${month}-${['05','07','08'].includes(month)?31:30}`,selector_counts:[{key:'img.guide',count}],anchors:[],pageviews:100,csv_status:'parsed',complete_export:false,...extra});
test('calendar validation rejects normalized impossible dates, reversed and excessive ranges',()=>{
 assert.deepEqual(math.period('2026-07-01','2026-08-31'),{start:'2026-07-01',end:'2026-08-31'});
 for(const pair of [['2026-02-30','2026-03-02'],['2026-08-01','2026-07-31'],['2026-01-01','2027-01-02']])assert.throws(()=>math.period(...pair));
 assert.equal(math.date('2028-02-29'),'2028-02-29');assert.throws(()=>math.date('2026-02-29'));
});
test('CSV retains unsupported originals and refuses to infer totals from duplicate selectors',()=>{
 assert.equal(math.parseCsv('x,y\n10,20').status,'unsupported');assert.equal(math.parseCsv('Selector,Clicks\na,1\na,2').status,'ambiguous');
 assert.deepEqual(math.parseCsv('Selector,Taps\n"a, b",7').selectors,[{key:'a, b',count:7}]);
 assert.throws(()=>math.parseCsv('x'.repeat(1000001)),/1 MB/);
});
test('ordered multi-period changes use B minus A and normalize by actual views',()=>{
 const c=math.compare([report(2,'08',21,{pageviews:300}),report(1,'07',7)]),r=c.rows[0];
 assert.deepEqual(c.reports.map(r=>r.id),[1,2]);assert.equal(r.changes[0].delta,14);assert.equal(r.changes[0].percent,200);assert.equal(r.changes[0].rateDelta,0);
 assert.equal(c.coordinateData,false);
});
test('missing selectors remain unknown unless the CSV is explicitly complete and parsed',()=>{
 const missing=report(1,'07',0,{selector_counts:[]}),present=report(2,'08',4);
 assert.equal(math.compare([missing,present]).rows[0].overall.state,'missing');
 assert.equal(math.compare([{...missing,complete_export:true},present]).rows[0].overall.state,'new');
 assert.equal(math.compare([{...missing,complete_export:true,csv_status:'unsupported'},present]).rows[0].points[0].count,null);
});
test('comparison isolates cohorts including project, device, segment, type and timezone',()=>{
 for(const [field,value] of [['project_id','other'],['device','desktop'],['segment','campaign'],['timezone','UTC'],['heatmap_type','rage-clicks'],['page_path','/other']])assert.throws(()=>math.compare([report(1,'07',7),report(2,'08',8,{[field]:value})]),/cùng/);
});
test('analyst verified keys match changed selectors without inventing coordinates',()=>{
 const a=report(1,'07',7,{anchors:[{key:'img.guide',matchKey:'suit-guide'}]}),b=report(2,'08',9,{selector_counts:[{key:'#new-image',count:9}],anchors:[{key:'#new-image',matchKey:'suit-guide'}]});
 const row=math.compare([a,b]).rows[0];assert.equal(row.key,'suit-guide');assert.equal(row.overall.delta,2);
 assert.throws(()=>math.compare([{...a,selector_counts:[{key:'img.guide',count:7},{key:'suit-guide',count:2}]},b]),/khóa/);
});
test('grouped comparisons sum disjoint months and preserve incomplete measurements',()=>{
 const rs=[report(1,'05',10),report(2,'06',20),report(3,'07',35),report(4,'08',25)];
 const c=math.compare(rs,{a:[1,2],b:[3,4]}),r=c.rows[0].grouped;
 assert.equal(r.a,30);assert.equal(r.b,60);assert.equal(r.percent,100);assert.equal(r.rateDelta,15);
 assert.throws(()=>math.compare(rs,{a:[1,2],b:[2,3]}),/chồng lấn/);
 assert.throws(()=>math.compare([rs[0],{...rs[1],start_date:'2026-05-15'}],{a:[1,2],b:[2]}),/chồng lấn/);
 assert.equal(math.compare([rs[0],{...rs[1],selector_counts:[]},rs[2],rs[3]],{a:[1,2],b:[3,4]}).rows[0].grouped.a,null);
});
test('collection limits and exact periods produce a bounded URL matrix',()=>{
 const b={siteId:1,projectId:'test',device:'mobile',name:'Review',paths:['/article','/article','/other'],periods:[{start:'2026-07-01',end:'2026-07-31'}]};
 assert.equal(math.collection(b).paths.length,2);assert.throws(()=>math.collection({...b,paths:Array.from({length:51},(_,i)=>'/'+i)}));
 assert.throws(()=>math.collection({...b,periods:[...b.periods,...b.periods]}));assert.throws(()=>math.collection({...b,projectId:''}));
});
