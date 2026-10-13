'use strict';
const {invalid,cleanPath}=require('./behaviorMath');
const {selectorsFromCsv}=require('./heatmapArchive');
const TYPES=['all-clicks','dead-clicks','rage-clicks','error-clicks','first-clicks','last-clicks'];
function date(value){
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value))invalid('Ngày phải có dạng YYYY-MM-DD');
 const d=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)invalid('Ngày không tồn tại');
 return value;
}
function period(start,end){date(start);date(end);if(end<start||(new Date(end)-new Date(start))/86400000>365)invalid('Khoảng ngày phải tăng dần và không quá 366 ngày');return {start,end};}
function cohort(b){
 if(!Number.isInteger(b.siteId)||b.siteId<1)invalid('Website không hợp lệ');
 if(!['desktop','mobile','tablet'].includes(b.device)||!TYPES.includes(b.heatmapType||'all-clicks'))invalid('Thiết bị hoặc loại heatmap không hợp lệ');
 const project=b.projectId||'';if(typeof project!=='string'||!/^([a-zA-Z0-9_-]{1,100})?$/.test(project))invalid('Project ID không hợp lệ');
 const segment=b.segment||'';if(typeof segment!=='string'||segment.length>500)invalid('Bộ lọc bổ sung quá dài');
 const timezone=b.timezone||'Asia/Ho_Chi_Minh';
 if(typeof timezone!=='string'||timezone.length>64)invalid('Múi giờ không hợp lệ');
 try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{invalid('Múi giờ không hợp lệ');}
 return {siteId:b.siteId,projectId:project,device:b.device,heatmapType:b.heatmapType||'all-clicks',segment:segment.trim(),timezone};
}
function parseCsv(text){
 if(!text)return {selectors:[],status:'none',warning:null};
 if(typeof text!=='string'||Buffer.byteLength(text)>1000000)invalid('CSV tối đa 1 MB');
 try{
  const selectors=selectorsFromCsv(text),keys=new Set();
  for(const s of selectors){if(keys.has(s.key))return {selectors:[],status:'ambiguous',warning:'CSV có selector trùng. Giữ file gốc; cần xác minh các dòng trước khi tính số lượt.'};keys.add(s.key);}
  return {selectors,status:'parsed',warning:null};
 }catch(e){if(e.statusCode!==400)throw e;return {selectors:[],status:'unsupported',warning:e.message};}
}
function values(report){
 const aliases=new Map((report.anchors||[]).filter(a=>a.matchKey).map(a=>[a.key,a.matchKey]));
 const map=new Map();
 for(const s of report.selector_counts||[]){const key=aliases.get(s.key)||s.key;if(map.has(key))invalid('Hai phần tử cùng một khóa đối chiếu trong một bản xuất');map.set(key,{count:s.count,selector:s.key});}
 return map;
}
function change(a,b){
 if(a===null||b===null)return {delta:null,percent:null,state:'missing'};
 return {delta:b-a,percent:a===0?null:(b-a)/a*100,state:a===0&&b>0?'new':b>a?'up':b<a?'down':'same'};
}
function compare(reports,groups){
 if(!Array.isArray(reports)||reports.length<2||reports.length>12)invalid('Chọn 2–12 bản xuất');
 const fields=['site_id','page_path','project_id','device','heatmap_type','segment','timezone'];
 if(reports.some(r=>fields.some(k=>r[k]!==reports[0][k])))invalid('Các bản xuất phải cùng URL, project, thiết bị, loại heatmap, bộ lọc và múi giờ');
 reports=[...reports].sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.end_date.localeCompare(b.end_date)||a.id-b.id);
 const maps=reports.map(values),keys=[...new Set(maps.flatMap(m=>[...m.keys()]))];
 const rows=keys.map(key=>{
  const points=reports.map((r,i)=>{
   const found=maps[i].get(key),count=found?found.count:r.complete_export&&r.csv_status==='parsed'?0:null;
   return {reportId:r.id,selector:found?.selector||null,count,per100Views:count!==null&&r.pageviews>0?count/r.pageviews*100:null};
  });
  return {key,points,changes:points.slice(1).map((p,i)=>({...change(points[i].count,p.count),from:reports[i].id,to:reports[i+1].id,rateDelta:points[i].per100Views!==null&&p.per100Views!==null?p.per100Views-points[i].per100Views:null})),overall:change(points[0].count,points.at(-1).count)};
 });
 rows.sort((a,b)=>Math.max(-1,...b.points.map(p=>p.count??-1))-Math.max(-1,...a.points.map(p=>p.count??-1))||a.key.localeCompare(b.key));
 const warnings=[];
 if(reports.some(r=>r.csv_status!=='parsed'))warnings.push('Một số bản chưa có CSV đọc được. Ảnh vẫn xem được; số lượt thiếu được giữ là chưa xác định.');
 if(reports.some(r=>!r.complete_export))warnings.push('Phần tử không xuất hiện trong CSV chưa được xác nhận đầy đủ được giữ là thiếu dữ liệu, không tính là 0.');
 if(reports.some((r,i)=>reports.slice(i+1).some(s=>r.start_date<=s.end_date&&s.start_date<=r.end_date)))warnings.push('Các khoảng ngày chồng lấn. Không cộng chúng thành tổng nhiều kỳ.');
 if(reports.some(r=>r.source==='legacy-archive'))warnings.push('Bản nhập từ kho cũ có metadata do người nhập khai báo; project chưa được xác định.');
 let grouped=null;
 if(groups){
  const select=list=>{
   if(!Array.isArray(list)||!list.length||new Set(list).size!==list.length||list.some(n=>!Number.isInteger(n)||!reports.some(r=>r.id===n)))invalid('Chọn bản xuất hợp lệ cho mỗi nhóm');
   const rs=reports.filter(r=>list.includes(r.id));
   if(rs.some((r,i)=>rs.slice(i+1).some(s=>r.start_date<=s.end_date&&s.start_date<=r.end_date)))invalid('Các khoảng trong một nhóm đang chồng lấn; không thể cộng tổng');
   return rs;
  };
  const a=select(groups.a),b=select(groups.b);
  if(a.some(r=>b.some(s=>r.start_date<=s.end_date&&s.start_date<=r.end_date)))invalid('Hai nhóm đang chồng lấn; hãy chọn các khoảng tách biệt');
  const sum=(items,key)=>items.some(p=>p[key]===null||p[key]===undefined)?null:items.reduce((s,p)=>s+p[key],0);
  const viewsA=sum(a,'pageviews'),viewsB=sum(b,'pageviews');
  grouped={a:a.map(r=>r.id),b:b.map(r=>r.id),pageviewsA:viewsA,pageviewsB:viewsB};
  for(const row of rows){
   const ac=sum(row.points.filter(p=>groups.a.includes(p.reportId)),'count'),bc=sum(row.points.filter(p=>groups.b.includes(p.reportId)),'count');
   const ar=ac!==null&&viewsA>0?ac/viewsA*100:null,br=bc!==null&&viewsB>0?bc/viewsB*100:null;
   row.grouped={a:ac,b:bc,per100ViewsA:ar,per100ViewsB:br,...change(ac,bc),rateDelta:ar!==null&&br!==null?br-ar:null};
  }
 }
 return {reports:reports.map(({raw_csv,content_hash,...r})=>r),rows,warnings,grouped,source:'clarity-portal-export',coordinateData:false};
}
function collection(b){
 const c=cohort(b);if(!c.projectId)invalid('Nhập Project ID Clarity để mở đúng project');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120)invalid('Tên đợt thu thập không hợp lệ');
 if(!Array.isArray(b.paths)||!b.paths.length||b.paths.length>50)invalid('Chọn 1–50 URL');
 const paths=[...new Set(b.paths.map(cleanPath))];
 if(!Array.isArray(b.periods)||!b.periods.length||b.periods.length>12)invalid('Chọn 1–12 khoảng ngày');
 const periods=b.periods.map(p=>{if(!p||typeof p!=='object')invalid('Khoảng ngày không hợp lệ');return period(p.start,p.end);});
 if(new Set(periods.map(p=>`${p.start}/${p.end}`)).size!==periods.length)invalid('Khoảng ngày bị trùng');
 return {...c,name:b.name.trim(),paths,periods};
}
module.exports={date,period,cohort,parseCsv,change,compare,collection,TYPES};
