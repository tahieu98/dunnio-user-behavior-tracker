'use strict';
const {query}=require('../config/database'),{invalid,cleanPath}=require('./behaviorMath'),{sameOrigin}=require('./pageCatalog');
const deviceOf=v=>/pc|desktop/i.test(v||'')?'desktop':/mobile/i.test(v||'')?'mobile':/tablet/i.test(v||'')?'tablet':String(v||'all').toLowerCase();
function slice(payload,origin,path,device){
 const rows=[];
 for(const group of payload||[])for(const r of group.information||[]){
  let u;try{u=new URL(r.Url||r.URL||r.url);}catch{continue;}
  if(!sameOrigin(u.origin,origin)||u.pathname!==path||device!=='all'&&deviceOf(r.Device)!==device)continue;
  for(const [field,value] of Object.entries(r))if(!['Url','URL','url','Device'].includes(field))rows.push({metric:group.metricName,field,url:u.origin+u.pathname,device:r.Device||'all',value});
 }return rows;
}
function metadata(r){const at=new Date(r.requested_at.replace(' ','T')+'Z');return {id:r.id,numOfDays:r.num_of_days,dimensions:r.dimensions.split(','),start:new Date(at.getTime()-r.num_of_days*86400000).toISOString(),end:at.toISOString(),timezone:'UTC'};}
function mergeRows(aRows,bRows){
 const numeric=v=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v));
 const key=r=>JSON.stringify([r.metric,r.field,r.url,r.device]),group=list=>{const m=new Map();for(const r of list){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
 const a=group(aRows),b=group(bRows);
 return [...new Set([...a.keys(),...b.keys()])].map(k=>{const aa=a.get(k)||[],bb=b.get(k)||[],row=aa[0]||bb[0],value=rows=>rows.length>1?rows.map(r=>r.value):rows[0]?.value??null,va=value(aa),vb=value(bb),ambiguous=aa.length>1||bb.length>1;
  return {...row,a:va,b:vb,ambiguous,delta:!ambiguous&&numeric(va)&&numeric(vb)?Number(va)-Number(vb):null};
 });
}
async function compare(q){
 const ids=[Number(q.exportA),Number(q.exportB)],siteId=Number(q.siteId),device=q.device||'all';cleanPath(q.path);
 if(!ids.every(v=>Number.isInteger(v)&&v>0)||!Number.isInteger(siteId)||!['all','desktop','mobile','tablet'].includes(device))invalid('Invalid Clarity comparison');
 const site=(await query('SELECT origin FROM tracking_sites WHERE id=?',[siteId]))[0];if(!site)invalid('Site not registered');
 const archives=await query("SELECT id,requested_at,num_of_days,dimensions,payload FROM clarity_exports WHERE id IN (?,?) AND project_id=? AND status='completed'",[...ids,process.env.CLARITY_PROJECT_ID||'']);
 const a=archives.find(r=>r.id===ids[0]),b=archives.find(r=>r.id===ids[1]);if(!a||!b)invalid('Export not found for this project');
 if(a.dimensions!==b.dimensions)invalid('Compare exports with the same dimensions');
 if(device!=='all'&&!a.dimensions.split(',').includes('Device'))invalid('These exports contain all devices; select All devices');
 const data=r=>slice(typeof r.payload==='string'?JSON.parse(r.payload):r.payload,site.origin,q.path,device);
 const rows=mergeRows(data(a),data(b));
 const ma=metadata(a),mb=metadata(b);
 return {a:ma,b:mb,rows,source:'clarity-aggregate',overlapping:ma.start<mb.end&&mb.start<ma.end,warning:'So sánh hai cửa sổ API đã lưu, không phải tháng lịch. Các cửa sổ có thể chồng lấn hoặc khác độ dài. Giá trị thiếu giữ null; không cộng số phiên, người dùng duy nhất hoặc tỷ lệ giữa các cửa sổ.'};
}
module.exports={compare,slice,metadata,deviceOf,mergeRows};
