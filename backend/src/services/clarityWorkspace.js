'use strict';
const crypto=require('crypto');
const {query,transaction}=require('../config/database');
const {invalid,cleanPath}=require('./behaviorMath');
const math=require('./clarityHeatmapMath');
const {pngSize}=require('./heatmapArchive');
const {writeAsset}=require('./snapshotCapture');
const json=v=>typeof v==='string'?JSON.parse(v):v;
const reportRow=r=>({...r,selector_counts:json(r.selector_counts)||[],anchors:json(r.anchors)||[],complete_export:!!r.complete_export});
const id=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)invalid('ID không hợp lệ');return n;};
const columns='id,site_id,page_path,project_id,device,heatmap_type,segment,start_date,end_date,timezone,pageviews,clicks,image_path,image_width,image_height,selector_counts,csv_status,complete_export,anchors,export_name,source,created_at';
async function catalog(){
 const [sites,pages]=await Promise.all([
  query('SELECT id,name,origin FROM tracking_sites ORDER BY name'),
  query('SELECT id,site_id,page_path,title,category FROM tracked_pages WHERE is_tracked=TRUE ORDER BY title')
 ]);
 return {sites,pages,projectId:process.env.CLARITY_PROJECT_ID||'',timezone:'Asia/Ho_Chi_Minh'};
}
async function list(o){
 const params=[id(o.siteId)],parts=['site_id=?'];
 if(o.path){cleanPath(o.path);parts.push('page_path=?');params.push(o.path);}
 if(o.device){if(!['desktop','mobile','tablet'].includes(o.device))invalid('Thiết bị không hợp lệ');parts.push('device=?');params.push(o.device);}
 const rows=await query(`SELECT ${columns} FROM clarity_heatmap_reports WHERE ${parts.join(' AND ')} ORDER BY start_date,end_date,id`,params);
 return rows.map(reportRow);
}
async function get(reportId){const rows=await query(`SELECT ${columns},raw_csv FROM clarity_heatmap_reports WHERE id=?`,[id(reportId)]);if(!rows[0]){const e=new Error('Không tìm thấy bản xuất');e.statusCode=404;throw e;}return reportRow(rows[0]);}
async function save(b,userId){
 const c=math.cohort(b),p=math.period(b.start,b.end);cleanPath(b.path);
 if(b.confirmed!==true)invalid('Xác nhận URL, khoảng ngày và bộ lọc của bản xuất');
 for(const k of ['pageviews','clicks'])if(b[k]!==null&&b[k]!==undefined&&(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>2147483647))invalid('Tổng lượt phải là số nguyên không âm');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>255)invalid('Tên file không hợp lệ');
 const csv=b.csv||'';const parsed=math.parseCsv(csv);
 if(b.completeExport!==undefined&&typeof b.completeExport!=='boolean')invalid('Xác nhận CSV đầy đủ không hợp lệ');
 if(b.completeExport&&parsed.status!=='parsed')invalid('Chỉ xác nhận đầy đủ khi CSV đọc được và không có selector trùng');
 let bytes=null,size={width:null,height:null},imagePath=null;
 if(b.png){
  if(typeof b.png!=='string'||b.png.length>14000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.png))invalid('PNG không hợp lệ hoặc lớn hơn 10 MB');
  bytes=Buffer.from(b.png,'base64');size=pngSize(bytes);
 }
 if(!bytes&&!csv.trim())invalid('Chọn ít nhất một CSV hoặc PNG');
 const metadata={...c,path:b.path,...p,pageviews:b.pageviews??null,clicks:b.clicks??null,completeExport:!!b.completeExport};
 const hash=crypto.createHash('sha256').update(JSON.stringify(metadata)).update(csv).update(bytes||Buffer.alloc(0)).digest('hex');
 const jobId=b.jobId===undefined||b.jobId===null?null:id(b.jobId);
 const page=await query('SELECT id FROM tracked_pages WHERE site_id=? AND page_path=? AND is_tracked=TRUE',[c.siteId,b.path]);if(!page.length)invalid('Đăng ký và bật trang trước khi nhập dữ liệu');
 // Validate job metadata before writing an asset. The lock inside the transaction validates again.
 function checkJob(j){
  if(!j||j.site_id!==c.siteId||j.page_path!==b.path||j.start_date!==p.start||j.end_date!==p.end||j.project_id!==c.projectId||j.device!==c.device||j.heatmap_type!==c.heatmapType||j.segment!==c.segment||j.timezone!==c.timezone)invalid('Bản xuất không khớp URL, khoảng ngày hoặc bộ lọc của mục thu thập');
 }
 const jobSql='SELECT j.*,r.site_id,r.project_id,r.device,r.heatmap_type,r.segment,r.timezone FROM clarity_collection_jobs j JOIN clarity_collection_runs r ON r.id=j.run_id WHERE j.id=?';
 if(jobId)checkJob((await query(jobSql,[jobId]))[0]);
 if(bytes){const assetHash=crypto.createHash('sha256').update(bytes).digest('hex'),filename=`clarity-${assetHash}.png`;await writeAsset(filename,bytes);imagePath=`/snapshots/${filename}`;}
 const saved=await transaction(async connection=>{
  if(jobId)checkJob((await connection.execute(jobSql+' FOR UPDATE',[jobId]))[0][0]);
  let reportId,duplicate=false;
  try{
   const [r]=await connection.execute('INSERT INTO clarity_heatmap_reports(site_id,page_path,project_id,device,heatmap_type,segment,start_date,end_date,timezone,pageviews,clicks,image_path,image_width,image_height,selector_counts,raw_csv,csv_status,complete_export,anchors,export_name,content_hash,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[c.siteId,b.path,c.projectId,c.device,c.heatmapType,c.segment,p.start,p.end,c.timezone,b.pageviews??null,b.clicks??null,imagePath,size.width,size.height,JSON.stringify(parsed.selectors),csv||null,parsed.status,!!b.completeExport,'[]',b.name.trim(),hash,userId]);reportId=r.insertId;
  }catch(e){
   if(e.code!=='ER_DUP_ENTRY')throw e;
   const [existing]=await connection.execute('SELECT id FROM clarity_heatmap_reports WHERE content_hash=? FOR UPDATE',[hash]);
   if(!existing[0])throw e;reportId=existing[0].id;duplicate=true;
  }
  if(jobId)await connection.execute("UPDATE clarity_collection_jobs SET report_id=?,status='imported',note='' WHERE id=?",[reportId,jobId]);
  return {id:reportId,duplicate};
 });
 return {...saved,status:parsed.status,selectors:parsed.selectors.length,warning:parsed.warning,source:'clarity-portal-export'};
}
async function anchors(reportId,b){
 if(b.confirmed!==true||!Array.isArray(b.anchors)||b.anchors.length>500)invalid('Xác nhận các điểm neo do người phân tích đánh dấu');
 // Serialize read/replace to avoid lost updates from two editors.
 return transaction(async c=>{
  const r=reportRow((await c.execute(`SELECT ${columns} FROM clarity_heatmap_reports WHERE id=? FOR UPDATE`,[id(reportId)]))[0][0]||{});
  if(!r.id)invalid('Không tìm thấy bản xuất');
  if(!r.image_path)invalid('Cần PNG của bản xuất để đánh dấu vị trí');
  const keys=new Set(r.selector_counts.map(s=>s.key)),seen=new Set();
  const result=b.anchors.map(a=>{
   if(!keys.has(a.key)||seen.has(a.key))invalid('Selector không tồn tại hoặc điểm neo bị trùng');seen.add(a.key);
   if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.y<0||a.x>=r.image_width||a.y>=r.image_height)invalid('Điểm neo nằm ngoài ảnh');
   const label=a.label||'',matchKey=a.matchKey||'';
   if(typeof label!=='string'||label.length>200||typeof matchKey!=='string'||matchKey.length>200)invalid('Nhãn hoặc khóa đối chiếu quá dài');
   return {key:a.key,x:a.x,y:a.y,label:label.trim(),matchKey:matchKey.trim(),source:'analyst-confirmed'};
  });
  math.compare([{...r,anchors:result},{...r,anchors:result}]);
  await c.execute('UPDATE clarity_heatmap_reports SET anchors=? WHERE id=?',[JSON.stringify(result),r.id]);return result;
 });
}
async function compare(b){
 if(!Array.isArray(b.reportIds)||b.reportIds.length<2||b.reportIds.length>12)invalid('Chọn 2–12 bản xuất');
 const ids=b.reportIds.map(id);if(new Set(ids).size!==ids.length)invalid('Không chọn trùng bản xuất');
 const rows=await query(`SELECT ${columns} FROM clarity_heatmap_reports WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
 if(rows.length!==ids.length)invalid('Một bản xuất không tồn tại');
 return math.compare(rows.map(reportRow),b.groups);
}
async function createRun(b,userId){
 const v=math.collection(b),pages=await query('SELECT page_path FROM tracked_pages WHERE site_id=? AND is_tracked=TRUE',[v.siteId]);
 if(v.paths.some(p=>!pages.some(r=>r.page_path===p)))invalid('Một URL chưa đăng ký hoặc đã tắt');
 return transaction(async c=>{
  const [r]=await c.execute('INSERT INTO clarity_collection_runs(site_id,name,project_id,device,heatmap_type,segment,timezone,created_by) VALUES (?,?,?,?,?,?,?,?)',[v.siteId,v.name,v.projectId,v.device,v.heatmapType,v.segment,v.timezone,userId]);
  for(const pagePath of v.paths)for(const p of v.periods)await c.execute('INSERT INTO clarity_collection_jobs(run_id,page_path,start_date,end_date) VALUES (?,?,?,?)',[r.insertId,pagePath,p.start,p.end]);
  return {id:r.insertId,jobs:v.paths.length*v.periods.length};
 });
}
async function runs(siteId){return query('SELECT r.*,COUNT(j.id) jobs,SUM(j.status=\'imported\') imported FROM clarity_collection_runs r JOIN clarity_collection_jobs j ON j.run_id=r.id WHERE r.site_id=? GROUP BY r.id ORDER BY r.id DESC LIMIT 100',[id(siteId)]);}
async function run(runId){
 const r=(await query('SELECT r.*,s.origin FROM clarity_collection_runs r JOIN tracking_sites s ON s.id=r.site_id WHERE r.id=?',[id(runId)]))[0];if(!r)invalid('Không tìm thấy đợt thu thập');
 const jobs=await query('SELECT * FROM clarity_collection_jobs WHERE run_id=? ORDER BY page_path,start_date,end_date',[r.id]);
 const portalUrl=`https://clarity.microsoft.com/projects/view/${encodeURIComponent(r.project_id)}/heatmaps`;
 return {...r,portalUrl,jobs:jobs.map(j=>({...j,url:r.origin+j.page_path,portalUrl,suggestedName:`Clarity-${r.id}-${j.id}-${j.start_date}-${j.end_date}`,instructions:`Mở project ${r.project_id}. Visited URL: is exactly ${r.origin+j.page_path}. Khoảng ngày: ${j.start_date} 00:00 đến ${j.end_date} 23:59; múi giờ ${r.timezone}. Thiết bị: ${r.device}. Loại: ${r.heatmap_type}. Bộ lọc/segment bổ sung: ${r.segment||'không có'}. Kiểm tra bộ lọc, đợi dữ liệu tải xong, xuất CSV và PNG riêng ngoài Compare. Ghi lại page views/clicks nếu có. Nhập bản xuất vào mục ${j.id}; đánh dấu thất bại nếu không lấy được, không thay dữ liệu thiếu bằng 0.`})),execution:'assisted-browser',notice:'Hàng đợi lưu bộ lọc và tiến độ. Trình duyệt phải đăng nhập Clarity; mở liên kết không tự áp dụng bộ lọc.'};
}
async function job(jobId,b){
 if(!['pending','reading','skipped','failed'].includes(b.status)||typeof (b.note||'')!=='string'||(b.note||'').length>1000)invalid('Trạng thái hoặc ghi chú không hợp lệ');
 const r=await query('UPDATE clarity_collection_jobs SET status=?,note=? WHERE id=? AND report_id IS NULL',[b.status,b.note||'',id(jobId)]);
 if(!r.affectedRows)invalid('Mục không tồn tại hoặc đã nhập dữ liệu');return {id:Number(jobId),status:b.status};
}
module.exports={catalog,list,get,save,anchors,compare,createRun,runs,run,job};
