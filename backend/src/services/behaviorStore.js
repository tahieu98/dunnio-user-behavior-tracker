const crypto = require('crypto');
const {query,transaction}=require('../config/database');
const {monthBounds,dayBounds,invalid}=require('./behaviorMath');
const pageCatalog=require('./pageCatalog');
const sqlDate=d=>d.toISOString().replace('T',' ').replace('Z','');
const relation=`a.source_event_id=c.event_id AND a.event_type='action' AND a.site_id=c.site_id AND a.session_hash=c.session_hash AND a.page_path=c.page_path AND a.layout_version=c.layout_version AND a.device=c.device AND a.view_id=c.view_id AND a.viewport_width=c.viewport_width AND a.occurred_at>=c.occurred_at AND a.occurred_at<=DATE_ADD(c.occurred_at,INTERVAL 30 MINUTE)`;
const action=`EXISTS(SELECT 1 FROM behavior_events a WHERE ${relation})`;
async function ingest(site,sessionId,events) {
 const paths=[...new Set(events.map(e=>e.pagePath))];
 if(site.tracking_scope==='all-public')await pageCatalog.register(site,paths,'tracker');
 const pages=await query(`SELECT page_path FROM tracked_pages WHERE site_id=? AND is_tracked=TRUE AND page_path IN (${paths.map(()=>'?').join(',')})`,[site.id,...paths]);
 for(const p of paths) if(!pages.some(v=>v.page_path===p)) invalid('Page must be registered and enabled for this site');
 const goals=typeof site.goal_paths==='string'?JSON.parse(site.goal_paths):site.goal_paths;
 for(const e of events) if(e.actionName==='navigation'&&!goals.includes(e.targetPath)) invalid('Destination is not a configured navigation goal');
 const sessionHash=crypto.createHmac('sha256',process.env.JWT_SECRET).update(`${site.id}:${sessionId}`).digest('hex');
 return transaction(async connection=>{
  let inserted=0;
  // Treat duplicate UUIDs as retries without updating stored measurements.
  for(const e of events) {
   const values=[e.id,site.id,e.pagePath,sessionHash,e.viewId,e.type,sqlDate(new Date(e.timestamp)),e.device,e.layoutVersion,e.viewportWidth,e.viewportHeight,e.documentHeight,e.x,e.y,e.col,e.row,e.region,e.elementKey,e.targetPath,e.actionName,e.sourceEventId,e.scrollDepth];
   try {const [r]=await connection.execute(`INSERT INTO behavior_events(event_id,site_id,page_path,session_hash,view_id,event_type,occurred_at,device,layout_version,viewport_width,viewport_height,document_height,x,y,grid_col,grid_row,region_key,element_key,target_path,action_name,source_event_id,scroll_depth) VALUES (${values.map(()=>'?').join(',')})`,values); inserted+=r.affectedRows;}
   catch(e){if(e.code!=='ER_DUP_ENTRY')throw e;}
  }
  return {inserted,duplicates:events.length-inserted};
 });
}
async function catalog(options={}) {
 const sites=await query('SELECT id,name,origin,public_key,goal_paths,tracking_scope FROM tracking_sites');
 const pages=await query('SELECT p.id,p.site_id,p.page_path url_path,p.title,CONCAT(s.origin,p.page_path) url,p.category FROM tracked_pages p JOIN tracking_sites s ON s.id=p.site_id WHERE p.is_tracked=TRUE ORDER BY p.category,p.title');
 const snapshots=await query('SELECT * FROM page_snapshots ORDER BY captured_at DESC');
 const layouts=await query(`SELECT site_id,page_path,device,layout_version,viewport_width,MAX(document_height) document_height,MIN(occurred_at) first_seen,MAX(occurred_at) last_seen FROM behavior_events GROUP BY site_id,page_path,device,layout_version,viewport_width`);
 const enriched=await pageCatalog.enrich(sites,pages,options);
 return {sites,...enriched,snapshots,layouts,source:'measured',timezone:'Asia/Ho_Chi_Minh'};
}
async function report({siteId,path,month,device,version,width,start,end}) {
 let b;
 if(start&&end){
  if(start instanceof Date && end instanceof Date) b={start,end,timezone:'Asia/Ho_Chi_Minh',month:null};
  else b=dayBounds(start,end);
 } else b=monthBounds(month);
 const where=`c.site_id=? AND c.page_path=? AND c.occurred_at>=? AND c.occurred_at<? AND c.device=? AND c.layout_version=? AND c.viewport_width=?`;
 const params=[siteId,path,sqlDate(b.start),sqlDate(b.end),device,version,width];
 const [cells,regions,summaries,scroll,outcomes,points]=await Promise.all([
  query(`SELECT c.grid_col col,c.grid_row gridRow,COUNT(*) clicks,SUM(${action}) actions,GROUP_CONCAT(DISTINCT c.element_key) elements,GROUP_CONCAT(DISTINCT c.region_key) regions FROM behavior_events c WHERE ${where} AND c.event_type='click' GROUP BY c.grid_col,c.grid_row ORDER BY c.grid_row,c.grid_col`,params),
  query(`SELECT c.region_key regionKey,SUM(c.event_type='click') clicks,SUM(c.event_type='click' AND ${action}) actions,COUNT(DISTINCT CASE WHEN c.event_type='exposure' THEN c.view_id END) exposures FROM behavior_events c WHERE ${where} AND c.event_type IN ('click','exposure') GROUP BY c.region_key`,params),
  query(`SELECT SUM(c.event_type='pageview') pageviews,COUNT(DISTINCT c.session_hash) sessions,SUM(c.event_type='click') clicks,SUM(c.event_type='click' AND ${action}) actions,MIN(c.occurred_at) first,MAX(c.occurred_at) last,MIN(c.document_height) minHeight,MAX(c.document_height) maxHeight FROM behavior_events c WHERE ${where}`,params),
  query(`SELECT c.scroll_depth depth,COUNT(DISTINCT c.view_id) views FROM behavior_events c WHERE ${where} AND c.event_type='scroll' GROUP BY c.scroll_depth`,params),
  query(`SELECT c.grid_col col,c.grid_row gridRow,a.action_name name,a.target_path targetPath,COUNT(DISTINCT c.event_id) count FROM behavior_events c JOIN behavior_events a ON ${relation} WHERE ${where} AND c.event_type='click' GROUP BY c.grid_col,c.grid_row,a.action_name,a.target_path`,params),
  query(`SELECT c.x,c.y,COUNT(*) clicks,SUM(${action}) actions FROM behavior_events c WHERE ${where} AND c.event_type='click' GROUP BY c.x,c.y ORDER BY clicks DESC LIMIT 5001`,params)
 ]);
 const row=summaries[0],summary={}; for(const k of ['pageviews','sessions','clicks','actions'])summary[k]=Number(row[k]||0);
 const rate=(n,d)=>d?Math.round(n/d*10000)/100:null;
 summary.clicksPer100Views=rate(summary.clicks,summary.pageviews);summary.actionRate=rate(summary.actions,summary.clicks);
 const measure=r=>({...r,clicks:Number(r.clicks),actions:Number(r.actions),per100Views:rate(Number(r.clicks),summary.pageviews),actionRate:rate(Number(r.actions),Number(r.clicks))});
 return {month:b.month||null,start:b.start||null,end:b.end||null,summary,hasData:!!row.first,points:points.slice(0,5000).map(p=>({x:Number(p.x),y:Number(p.y),clicks:Number(p.clicks),actions:Number(p.actions)})),pointsTruncated:points.length>5000,cells:cells.map(r=>({...measure(r),row:r.gridRow,elements:r.elements?r.elements.split(','):[],regions:r.regions?r.regions.split(','):[]})),regions:regions.map(r=>({...measure(r),key:r.regionKey})),scroll,outcomes:outcomes.map(r=>({...r,row:r.gridRow,count:Number(r.count)})),geometry:{minHeight:Number(row.minHeight)||null,maxHeight:Number(row.maxHeight)||null},coverage:{first:row.first,last:row.last},lowSample:summary.pageviews<100};
}
module.exports={ingest,catalog,report};
