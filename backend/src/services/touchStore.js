'use strict';
const {query,transaction,pool}=require('../config/database');
const crypto=require('crypto');
const math=require('./touchMath');
const pageCatalog=require('./pageCatalog');
const sqlDate=t=>new Date(t).toISOString().replace('T',' ').replace('Z','');
const contextKeys=['page_path','device','layout_version','viewport_width','viewport_height','document_height','sample_rate'];
const MAX_POINTS=10000;
function aggregate(batch){
 const c=batch.context,context={page_path:c.pagePath,device:c.device,layout_version:c.layoutVersion,viewport_width:c.viewportWidth,viewport_height:c.viewportHeight,document_height:c.documentHeight,sample_rate:batch.sampleRate};
 const pages=new Map(),points=new Map(),elements=new Map();
 for(const e of batch.entries){
  const event_date=math.eventDate(e.timestamp),base={event_date,...context},ph=math.hash(base),time=sqlDate(e.timestamp);
  if(!pages.has(ph))pages.set(ph,{...base,dimension_hash:ph,pageviews:0,taps:0,first_seen:time,last_seen:time});
  const p=pages.get(ph);p.first_seen=p.first_seen<time?p.first_seen:time;p.last_seen=p.last_seen>time?p.last_seen:time;p[e.type==='tap'?'taps':'pageviews']+=e.count;if(e.type!=='tap')continue;
  const anchor={element_key:e.elementKey,region_key:e.region,anchor_quality:e.anchorQuality,fixed:e.fixed?1:0,pointer_type:e.pointerType};
  const point={...base,...anchor,x_bucket:Math.floor(e.x/20),y_bucket:Math.floor(e.y/20),grid_col:Math.floor(e.x/c.viewportWidth*12)+1,grid_row:Math.floor(e.y/50)+1},qh=math.hash(point);
  if(!points.has(qh))points.set(qh,{...point,dimension_hash:qh,count:0});points.get(qh).count+=e.count;
  const element={...base,...anchor,u_bin:Math.min(19,Math.floor(e.elementU*20)),v_bin:Math.min(19,Math.floor(e.elementV*20))},eh=math.hash(element),rect=e.elementRect;
  if(!elements.has(eh))elements.set(eh,{...element,dimension_hash:eh,count:0,sum_x:0,sum_y:0,min_x:rect.x,min_y:rect.y,max_x:rect.x+rect.width,max_y:rect.y+rect.height});
  const a=elements.get(eh);a.count+=e.count;a.sum_x+=e.x*e.count;a.sum_y+=e.y*e.count;a.min_x=Math.min(a.min_x,rect.x);a.min_y=Math.min(a.min_y,rect.y);a.max_x=Math.max(a.max_x,rect.x+rect.width);a.max_y=Math.max(a.max_y,rect.y+rect.height);
 }
 return {pages:[...pages.values()],points:[...points.values()],elements:[...elements.values()]};
}
async function upsert(connection,table,siteId,rows,updates){
 for(const row of rows.sort((a,b)=>a.dimension_hash.localeCompare(b.dimension_hash))){const keys=['site_id',...Object.keys(row)],values=[siteId,...Object.values(row)];await connection.execute(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map(()=>'?')}) ON DUPLICATE KEY UPDATE ${updates}`,values);}
}
async function ingest(site,input){
 const batch=math.validateBatch(input),claimToken=crypto.randomUUID(),data=aggregate(batch),pageviews=batch.entries.filter(e=>e.type==='pageview').reduce((n,e)=>n+e.count,0),taps=batch.entries.filter(e=>e.type==='tap').reduce((n,e)=>n+e.count,0);
 for(let attempt=0;;attempt++)try{return await transaction(async connection=>{
  // The no-op UPDATE obtains an exclusive receipt lock. A duplicate INSERT exception would
  // retain shared locks, causing concurrent retries to deadlock when upgrading to FOR UPDATE.
  await connection.execute('INSERT INTO touch_batches(site_id,batch_id,payload_sha256,claim_token,sample_rate,entry_count,pageviews,taps) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE batch_id=batch_id',[site.id,batch.batchId,batch.payloadHash,claimToken,batch.sampleRate,batch.entries.length,pageviews,taps]);
  const [receipts]=await connection.execute('SELECT payload_sha256,claim_token FROM touch_batches WHERE site_id=? AND batch_id=? FOR UPDATE',[site.id,batch.batchId]);
  if(receipts[0].claim_token!==claimToken){if(receipts[0].payload_sha256!==batch.payloadHash){const conflict=new Error('Batch ID already used with different payload');conflict.statusCode=409;throw conflict;}return {accepted:true,duplicate:true,batchId:batch.batchId,entries:0,pageviews:0,taps:0};}
  if(site.tracking_scope==='all-public')await connection.execute('INSERT IGNORE INTO tracked_pages(site_id,page_path,title,category) VALUES (?,?,?,?)',[site.id,batch.context.pagePath,pageCatalog.titleOf(batch.context.pagePath),'tracker']);
  const [pages]=await connection.execute('SELECT page_path FROM tracked_pages WHERE site_id=? AND page_path=? AND is_tracked=TRUE FOR UPDATE',[site.id,batch.context.pagePath]);if(!pages.length)math.invalid('Page must be registered and enabled for this site');
  await upsert(connection,'touch_daily_pages',site.id,data.pages,'pageviews=pageviews+VALUES(pageviews),taps=taps+VALUES(taps),first_seen=LEAST(first_seen,VALUES(first_seen)),last_seen=GREATEST(last_seen,VALUES(last_seen))');
  await upsert(connection,'touch_daily_points',site.id,data.points,'count=count+VALUES(count)');
  await upsert(connection,'touch_daily_elements',site.id,data.elements,'count=count+VALUES(count),sum_x=sum_x+VALUES(sum_x),sum_y=sum_y+VALUES(sum_y),min_x=LEAST(min_x,VALUES(min_x)),min_y=LEAST(min_y,VALUES(min_y)),max_x=GREATEST(max_x,VALUES(max_x)),max_y=GREATEST(max_y,VALUES(max_y))');
  return {accepted:true,duplicate:false,batchId:batch.batchId,entries:batch.entries.length,pageviews,taps};
 });}catch(e){if(!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(e.code)||attempt>=2)throw e;}
}
async function catalog(){
 const results=await Promise.all([query('SELECT id,name,origin,public_key FROM tracking_sites ORDER BY name,id'),query('SELECT id,site_id,page_path,title,category FROM tracked_pages WHERE is_tracked=TRUE ORDER BY site_id,page_path'),query('SELECT site_id,page_path,device,layout_version,viewport_width,document_height,MIN(first_seen) first_seen,MAX(last_seen) last_seen FROM touch_daily_pages GROUP BY site_id,page_path,device,layout_version,viewport_width,document_height ORDER BY last_seen DESC'),query('SELECT * FROM page_snapshots ORDER BY captured_at DESC')]);
 return {sites:results[0],pages:results[1],layouts:results[2],snapshots:results[3]};
}
async function periodReport(options,period,connection){
 const read=(sql,params)=>connection.execute(sql,params).then(([rows])=>rows);
 const version=period.version||options.version,width=period.width||options.width,params=[options.siteId,options.path,options.device,version,width,period.start,period.end],where='site_id=? AND page_path=? AND device=? AND layout_version=? AND viewport_width=? AND event_date>=? AND event_date<=?';
 const [pages,points,elements,snapshots]=await Promise.all([
  read(`SELECT SUM(pageviews) pageviews,SUM(taps) taps,MIN(document_height) minHeight,MAX(document_height) maxHeight,MIN(viewport_height) minViewportHeight,MAX(viewport_height) maxViewportHeight,COUNT(*) records FROM touch_daily_pages WHERE ${where}`,params),
  read(`SELECT x_bucket,y_bucket,grid_col,grid_row,element_key,region_key,anchor_quality,fixed,pointer_type,document_height,viewport_height,SUM(count) count FROM touch_daily_points WHERE ${where} GROUP BY x_bucket,y_bucket,grid_col,grid_row,element_key,region_key,anchor_quality,fixed,pointer_type,document_height,viewport_height ORDER BY count DESC,x_bucket,y_bucket LIMIT ${MAX_POINTS+1}`,params),
  read(`SELECT element_key,region_key,anchor_quality,fixed,SUM(count) count,SUM(sum_x) sumX,SUM(sum_y) sumY,MIN(min_x) minX,MIN(min_y) minY,MAX(max_x) maxX,MAX(max_y) maxY FROM touch_daily_elements WHERE ${where} GROUP BY element_key,region_key,anchor_quality,fixed ORDER BY count DESC`,params),
  read('SELECT * FROM page_snapshots WHERE site_id=? AND page_path=? AND device=? AND layout_version=? AND viewport_width=? ORDER BY captured_at DESC',[options.siteId,options.path,options.device,version,width])
 ]);
 const s=pages[0],pageviews=math.safeCount(s.pageviews),taps=math.safeCount(s.taps),geometry={minHeight:s.minHeight?Number(s.minHeight):null,maxHeight:s.maxHeight?Number(s.maxHeight):null,minViewportHeight:s.minViewportHeight?Number(s.minViewportHeight):null,maxViewportHeight:s.maxViewportHeight?Number(s.maxViewportHeight):null};
 const [cells,rates]=await Promise.all([read(`SELECT grid_col col,grid_row gridRow,SUM(count) count FROM touch_daily_points WHERE ${where} AND fixed=FALSE GROUP BY grid_col,grid_row ORDER BY grid_row,grid_col`,params),read(`SELECT DISTINCT sample_rate FROM touch_daily_pages WHERE ${where} ORDER BY sample_rate`,params)]);
 return {...period,version,width,summary:{pageviews,taps,tapsPer100Views:math.rate(taps,pageviews)},hasData:Number(s.records)>0,sampleRates:rates.map(r=>Number(r.sample_rate)),points:points.slice(0,MAX_POINTS).map(p=>({...representative(p,width),count:math.safeCount(p.count),col:p.grid_col,row:p.grid_row,elementKey:p.element_key,region:p.region_key,anchorQuality:p.anchor_quality,fixed:!!p.fixed,documentHeight:p.document_height,viewportHeight:p.viewport_height,pointerType:p.pointer_type})),cells:cells.map(c=>({col:c.col,row:c.gridRow,count:math.safeCount(c.count)})),elements:elements.map(e=>({elementKey:e.element_key,region:e.region_key,anchorQuality:e.anchor_quality,fixed:!!e.fixed,count:math.safeCount(e.count),centroidX:Number(e.sumX)/math.safeCount(e.count),centroidY:Number(e.sumY)/math.safeCount(e.count),bounds:{minX:Number(e.minX),minY:Number(e.minY),maxX:Number(e.maxX),maxY:Number(e.maxY)}})),geometry,snapshot:geometry.minHeight===geometry.maxHeight?snapshots.find(s=>Number(s.document_height)===geometry.minHeight)||null:null,truncated:points.length>MAX_POINTS};
}
function representative(p,width){return {x:(Math.max(p.x_bucket*20,(p.grid_col-1)*width/12)+Math.min((p.x_bucket+1)*20,p.grid_col*width/12,width))/2,y:(Math.max(p.y_bucket*20,(p.grid_row-1)*50)+Math.min((p.y_bucket+1)*20,p.grid_row*50,p.fixed?p.viewport_height:p.document_height))/2};}
async function report(input){
 const options=math.reportOptions(input),periods=[],connection=await pool.getConnection();
 try{
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.beginTransaction();
  // All periods, counters and denominators share one InnoDB snapshot while ingestion continues.
  for(const p of options.periods)periods.push(await periodReport(options,p,connection));
  const result={source:'first-party-aggregated',timezone:'Asia/Ho_Chi_Minh',periods,comparison:math.compare(periods),truncated:periods.some(p=>p.truncated)};
  await connection.commit();return result;
 }catch(e){await connection.rollback();throw e;}finally{connection.release();}
}
module.exports={ingest,catalog,report,aggregate,representative,contextKeys};
