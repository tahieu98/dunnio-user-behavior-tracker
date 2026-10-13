'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {promisify}=require('node:util');
const {transaction}=require('../config/database');
const {cleanPath,invalid,hash}=require('./touchMath');
const {assetDirectory}=require('./snapshotCapture');
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);
const TABLES=['touch_daily_pages','touch_daily_points','touch_daily_elements'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES=256*1024*1024;
const BASE=['site_id','event_date','dimension_hash','page_path','device','layout_version','viewport_width','viewport_height','document_height','sample_rate'];
const ANCHOR=['element_key','region_key','anchor_quality','fixed','pointer_type'];
const FIELDS={touch_daily_pages:[...BASE,'pageviews','taps','first_seen','last_seen'],touch_daily_points:[...BASE,...ANCHOR,'x_bucket','y_bucket','grid_col','grid_row','count'],touch_daily_elements:[...BASE,...ANCHOR,'u_bin','v_bin','count','sum_x','sum_y','min_x','min_y','max_x','max_y']};
const key=value=>/^[a-zA-Z0-9_.:-]{1,80}$/.test(value||'');
function integer(value,min,max){return Number.isSafeInteger(value)&&value>=min&&value<=max;}
function count(value,positive=false){if(typeof value==='number'&&!Number.isSafeInteger(value)||!/^\d+$/.test(String(value)))invalid('Invalid archive count');const n=BigInt(value);if(n>(1n<<64n)-1n||n<(positive?1n:0n))invalid('Invalid archive count');return n;}
function rowContext(r){return Object.fromEntries(['event_date','page_path','device','layout_version','viewport_width','viewport_height','document_height','sample_rate'].map(k=>[k,k==='sample_rate'?Number(r[k]):r[k]]));}
function validateRows(p,ids){
 const totals={pages:new Map(),points:new Map(),elements:new Map()},seen=new Set();
 for(const table of TABLES)for(const r of p.tables[table]){
  if(Object.keys(r).sort().join()!==FIELDS[table].slice().sort().join())invalid('Invalid archived row columns');
  if(!ids.has(r.site_id)||r.event_date!==p.date||!/^[a-f0-9]{64}$/.test(r.dimension_hash||''))invalid('Invalid archive row identity');cleanPath(r.page_path);
  if(!['desktop','tablet','mobile'].includes(r.device)||!key(r.layout_version)||!integer(r.viewport_width,100,10000)||!integer(r.viewport_height,100,10000)||!integer(r.document_height,100,200000)||!Number.isFinite(Number(r.sample_rate))||Number(r.sample_rate)<0.000001||Number(r.sample_rate)>1||Number(Number(r.sample_rate).toFixed(6))!==Number(r.sample_rate))invalid('Invalid archive geometry');
  const base=rowContext(r),baseKey=r.site_id+':'+hash(base),digest={...base};
  if(table==='touch_daily_pages'){
   const taps=count(r.taps);count(r.pageviews);
   for(const date of [r.first_seen,r.last_seen]){const t=Date.parse(String(date).replace(' ','T')+'Z');if(!Number.isFinite(t)||new Date(t+7*3600000).toISOString().slice(0,10)!==p.date)invalid('Invalid archive measurement time');}
   if(r.first_seen>r.last_seen)invalid('Invalid archive measurement order');totals.pages.set(baseKey,taps);
  }else{
   if(!key(r.element_key)||!key(r.region_key)||!['explicit','structural'].includes(r.anchor_quality)||![0,1].includes(r.fixed)||!['mouse','pen','touch'].includes(r.pointer_type))invalid('Invalid archived anchor');
   Object.assign(digest,Object.fromEntries(ANCHOR.map(k=>[k,r[k]])));const n=count(r.count,true);
   if(table==='touch_daily_points'){
    const height=r.fixed?r.viewport_height:r.document_height;
    if(!integer(r.x_bucket,0,Math.ceil(r.viewport_width/20)-1)||!integer(r.y_bucket,0,Math.ceil(height/20)-1)||!integer(r.grid_col,1,12)||!integer(r.grid_row,1,Math.ceil(height/50)))invalid('Invalid archived point grid');
    const x0=Math.max(r.x_bucket*20,(r.grid_col-1)*r.viewport_width/12),x1=Math.min((r.x_bucket+1)*20,r.grid_col*r.viewport_width/12,r.viewport_width),y0=Math.max(r.y_bucket*20,(r.grid_row-1)*50),y1=Math.min((r.y_bucket+1)*20,r.grid_row*50,height);
    if(x0>=x1||y0>=y1)invalid('Archived point bucket does not intersect its grid cell');
    Object.assign(digest,{x_bucket:r.x_bucket,y_bucket:r.y_bucket,grid_col:r.grid_col,grid_row:r.grid_row});totals.points.set(baseKey,(totals.points.get(baseKey)||0n)+n);
   }else{
    if(!integer(r.u_bin,0,19)||!integer(r.v_bin,0,19))invalid('Invalid archived relative bins');
    for(const f of ['sum_x','sum_y','min_x','min_y','max_x','max_y'])if(!Number.isFinite(Number(r[f])))invalid('Invalid archived element position');
    if(Number(r.min_x)>=Number(r.max_x)||Number(r.min_y)>=Number(r.max_y))invalid('Invalid archived element bounds');
    Object.assign(digest,{u_bin:r.u_bin,v_bin:r.v_bin});totals.elements.set(baseKey,(totals.elements.get(baseKey)||0n)+n);
   }
  }
  if(hash(digest)!==r.dimension_hash)invalid('Archived dimension hash mismatch');
  const identity=table+':'+r.site_id+':'+r.dimension_hash;if(seen.has(identity))invalid('Duplicate archived aggregate');seen.add(identity);
 }
 for(const [identity,taps] of totals.pages){if((totals.points.get(identity)||0n)!==taps||(totals.elements.get(identity)||0n)!==taps)invalid('Archived aggregate totals disagree');}
 for(const m of [totals.points,totals.elements])for(const identity of m.keys())if(!totals.pages.has(identity))invalid('Archived point has no page context');
}
function calendar(value){
 if(!/^20\d\d-\d\d-\d\d$/.test(value||''))invalid('Archive date must use YYYY-MM-DD');
 const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)invalid('Invalid calendar date');return value;
}
function yesterday(now=new Date()){return new Date(+now+7*3600000-86400000).toISOString().slice(0,10);}
function archiveDirectory(){return path.resolve(process.env.TOUCH_ARCHIVE_DIR||path.join(process.env.DESKTOP_DATA_ROOT||path.resolve(__dirname,'../../../.local'),'touch-archives'));}
function imageName(imagePath){
 if(typeof imagePath!=='string'||!/^\/snapshots\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.png$/.test(imagePath)||imagePath.includes('..'))invalid('Unsafe snapshot path');
 return path.basename(imagePath);
}
function validateImage(snapshot,bytes){
 if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==snapshot.viewport_width||bytes.readUInt32BE(20)!==snapshot.document_height)invalid('Snapshot PNG geometry mismatch');
}
async function atomicFile(destination,bytes){
 await fs.mkdir(path.dirname(destination),{recursive:true});
 try{const old=await fs.readFile(destination);if(sha(old)!==sha(bytes))invalid('Existing archive/asset has conflicting content');return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const temporary=destination+'.'+crypto.randomUUID()+'.partial';
 try{await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});await fs.rename(temporary,destination);}finally{await fs.unlink(temporary).catch(()=>{});}
}
async function exportDay({date=yesterday(),directory=archiveDirectory(),siteId}={}){
 calendar(date);if(siteId!==undefined&&(!Number.isInteger(siteId)||siteId<1))invalid('Invalid archive site');
 const payload=await transaction(async c=>{
  const tables={};for(const table of TABLES){const casts=table==='touch_daily_pages'?',CAST(pageviews AS CHAR) pageviews,CAST(taps AS CHAR) taps':',CAST(count AS CHAR) count';const [rows]=await c.execute(`SELECT *${casts} FROM ${table} WHERE event_date=?${siteId?' AND site_id=?':''} ORDER BY site_id,dimension_hash`,siteId?[date,siteId]:[date]);tables[table]=rows;}
  const ids=[...new Set(TABLES.flatMap(t=>tables[t].map(r=>r.site_id)))];
  const sites=[],pages=[],snapshots=[];
  for(const id of ids){
   const [s]=await c.execute('SELECT id,name,origin FROM tracking_sites WHERE id=?',[id]);sites.push(s[0]);
   const paths=[...new Set(tables.touch_daily_pages.filter(r=>r.site_id===id).map(r=>r.page_path))];
   for(const pagePath of paths){
    const [p]=await c.execute('SELECT site_id,page_path,title,category,is_tracked FROM tracked_pages WHERE site_id=? AND page_path=?',[id,pagePath]);pages.push(...p);
    const [imgs]=await c.execute('SELECT site_id,page_path,device,layout_version,viewport_width,document_height,image_path,captured_at FROM page_snapshots WHERE site_id=? AND page_path=? ORDER BY layout_version,device,viewport_width',[id,pagePath]);
    const contexts=tables.touch_daily_pages.filter(r=>r.site_id===id&&r.page_path===pagePath);
    for(const img of imgs.filter(s=>contexts.some(r=>r.device===s.device&&r.layout_version===s.layout_version&&r.viewport_width===s.viewport_width))){const name=imageName(img.image_path);let bytes;try{bytes=await fs.readFile(path.join(assetDirectory(),name));}catch(e){if(e.code==='ENOENT')throw new Error('Snapshot file missing: '+name);throw e;}
     validateImage(img,bytes);snapshots.push({...img,image_sha256:sha(bytes),image_base64:bytes.toString('base64')});}
   }
  }
  return {schemaVersion:1,date,timezone:'Asia/Ho_Chi_Minh',source:'first-party-aggregated',sites,pages,snapshots,tables};
 });
 validatePayload(payload);const raw=Buffer.from(JSON.stringify(payload));if(raw.length>MAX_BYTES)invalid('Archive exceeds 256 MiB; export one site per file');
 const digest=sha(raw),bytes=await gzip(raw,{level:6}),stem=`touch-${date}${siteId?'-site-'+siteId:''}-${digest.slice(0,16)}`;
 const file=path.join(path.resolve(directory),stem+'.json.gz');
 const manifest={schemaVersion:1,archiveId:digest,date,timezone:payload.timezone,file:path.basename(file),sha256:sha(bytes),payloadSha256:digest,compressedBytes:bytes.length,uncompressedBytes:raw.length,rows:Object.fromEntries(TABLES.map(t=>[t,payload.tables[t].length])),snapshots:payload.snapshots.length};
 await atomicFile(file,bytes);await atomicFile(file+'.manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 return {...manifest,file,manifestFile:file+'.manifest.json'};
}
async function readArchive(file){
 const manifest=JSON.parse(await fs.readFile(file+'.manifest.json','utf8'));
 if(manifest.schemaVersion!==1||manifest.file!==path.basename(file)||!Number.isInteger(manifest.compressedBytes)||manifest.compressedBytes>MAX_BYTES||manifest.compressedBytes<1)invalid('Invalid archive manifest');
 const stat=await fs.stat(file);if(stat.size!==manifest.compressedBytes)invalid('Archive size mismatch');
 const bytes=await fs.readFile(file);if(sha(bytes)!==manifest.sha256)invalid('Archive checksum mismatch');
 const raw=await gunzip(bytes,{maxOutputLength:MAX_BYTES});if(raw.length!==manifest.uncompressedBytes||sha(raw)!==manifest.payloadSha256||manifest.archiveId!==manifest.payloadSha256)invalid('Archive payload checksum mismatch');
 const payload=JSON.parse(raw.toString('utf8'));validatePayload(payload);return {manifest,payload};
}
function validatePayload(p){
 if(p?.schemaVersion!==1||p.timezone!=='Asia/Ho_Chi_Minh'||p.source!=='first-party-aggregated')invalid('Unsupported archive schema');calendar(p.date);
 if(!Array.isArray(p.sites)||!Array.isArray(p.pages)||!Array.isArray(p.snapshots)||p.sites.length>1000||p.snapshots.length>10000||!p.tables||Object.keys(p.tables).sort().join()!==TABLES.slice().sort().join())invalid('Invalid archive collections');
 const ids=new Set();for(const s of p.sites){let u;try{u=new URL(s.origin);}catch{invalid('Invalid archived site');}if(!Number.isInteger(s.id)||s.id<1||ids.has(s.id)||u.origin!==s.origin||!['http:','https:'].includes(u.protocol)||typeof s.name!=='string'||s.name.length>120||!s.name.trim())invalid('Invalid archived site');ids.add(s.id);}
 for(const page of p.pages){if(!ids.has(page.site_id)||typeof page.title!=='string'||page.title.length>255||typeof page.category!=='string'||page.category.length>100)invalid('Invalid archived page');cleanPath(page.page_path);}
 for(const table of TABLES)if(!Array.isArray(p.tables[table])||p.tables[table].length>1000000)invalid('Archive row limit exceeded');validateRows(p,ids);
 const paths=new Set(p.pages.map(r=>r.site_id+':'+r.page_path));for(const r of p.tables.touch_daily_pages)if(!paths.has(r.site_id+':'+r.page_path))invalid('Archived measurement lacks page metadata');
 for(const s of p.snapshots){if(!ids.has(s.site_id)||typeof s.image_base64!=='string'||s.image_base64.length>MAX_BYTES*1.4)invalid('Invalid archived snapshot');cleanPath(s.page_path);imageName(s.image_path);const b=Buffer.from(s.image_base64,'base64');if(sha(b)!==s.image_sha256)invalid('Snapshot checksum mismatch');validateImage(s,b);}
}
async function restoreFile({file}){
 const {manifest,payload:p}=await readArchive(path.resolve(file));
 return transaction(async c=>{
  // Reserve the unique receipt first: concurrent duplicate imports wait for this transaction.
  try{await c.execute('INSERT INTO touch_archive_restores(archive_id,payload_sha256,event_date) VALUES (?,?,?)',[manifest.archiveId,manifest.payloadSha256,p.date]);}
  catch(e){if(e.code==='ER_DUP_ENTRY')return {duplicate:true,archiveId:manifest.archiveId,rows:0};throw e;}
  const siteMap=new Map();
  for(const s of p.sites){const [old]=await c.execute('SELECT id FROM tracking_sites WHERE origin=? FOR UPDATE',[s.origin]);let id=old[0]?.id;
   if(!id){const [r]=await c.execute('INSERT INTO tracking_sites(name,origin,public_key,goal_paths) VALUES (?,?,?,?)',[s.name,s.origin,crypto.randomUUID(),'[]']);id=r.insertId;}siteMap.set(s.id,id);
   for(const table of TABLES){const [rows]=await c.execute(`SELECT COUNT(*) total FROM ${table} WHERE site_id=? AND event_date=?`,[id,p.date]);if(Number(rows[0].total))invalid('Target site/day already has measurements; restore into an empty database or date');}
  }
  // Validate column names against actual migration schema before constructing SQL identifiers.
  const columns={};for(const table of TABLES){const [schema]=await c.execute('SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[table]);columns[table]=schema.map(v=>v.name);if(!columns[table].length)throw new Error('Run migrations before restore');}
  for(const page of p.pages){await c.execute('INSERT IGNORE INTO tracked_pages(site_id,page_path,title,category,is_tracked) VALUES (?,?,?,?,?)',[siteMap.get(page.site_id),page.page_path,page.title,page.category,page.is_tracked?1:0]);}
  let count=0;
  for(const table of TABLES)for(const row of p.tables[table]){
   const names=columns[table];if(Object.keys(row).sort().join()!==names.slice().sort().join())invalid('Archived columns differ from installed schema');
   const vals=names.map(n=>n==='site_id'?siteMap.get(row.site_id):row[n]);
   await c.execute(`INSERT INTO ${table} (${names.map(n=>'`'+n+'`').join(',')}) VALUES (${names.map(()=>'?').join(',')})`,vals);count++;
  }
  for(const s of p.snapshots){const bytes=Buffer.from(s.image_base64,'base64');await atomicFile(path.join(assetDirectory(),imageName(s.image_path)),bytes);
   const vals=[siteMap.get(s.site_id),s.page_path,s.device,s.layout_version,s.viewport_width,s.document_height,s.image_path,s.captured_at];
   const [existing]=await c.execute('SELECT image_path,document_height FROM page_snapshots WHERE site_id=? AND page_path=? AND device=? AND layout_version=? AND viewport_width=?',vals.slice(0,5));
   if(existing.length&&(existing[0].image_path!==s.image_path||existing[0].document_height!==s.document_height))invalid('Snapshot metadata conflict');
   if(!existing.length)await c.execute('INSERT INTO page_snapshots(site_id,page_path,device,layout_version,viewport_width,document_height,image_path,captured_at) VALUES (?,?,?,?,?,?,?,?)',vals);
  }
  return {archiveId:manifest.archiveId,duplicate:false,rows:count,sites:Object.fromEntries(siteMap),snapshots:p.snapshots.length};
 });
}
async function copyArchive({file,destination}){
 await readArchive(file);const directory=path.resolve(destination);await fs.mkdir(directory,{recursive:true});
 for(const source of [file,file+'.manifest.json'])await atomicFile(path.join(directory,path.basename(source)),await fs.readFile(source));
 return {destination:directory,file:path.join(directory,path.basename(file))};
}
module.exports={TABLES,calendar,yesterday,archiveDirectory,exportDay,readArchive,validatePayload,restoreFile,copyArchive};
