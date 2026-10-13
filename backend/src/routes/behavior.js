const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {authenticate,authorize}=require('../middleware/auth');
const {asyncHandler}=require('../middleware/errorHandler');
const {query}=require('../config/database');
const store=require('../services/behaviorStore');
const pageCatalog=require('../services/pageCatalog');
const {validateBatch,cleanPath,monthBounds,dayBounds,compare,invalid}=require('../services/behaviorMath');
const router=express.Router();
const collector=express.Router();
const ingestLimit=rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false});
collector.post('/events',ingestLimit,asyncHandler(async(req,res)=>{
 const events=validateBatch(req.body);
 const sites=await query('SELECT * FROM tracking_sites WHERE public_key=?',[req.body.siteKey]);
 const site=sites[0];
 if(!site || !pageCatalog.sameOrigin(req.headers.origin,site.origin))return res.status(403).json({success:false,message:'Site origin/key mismatch'});
 const result=await store.ingest(site,req.body.sessionId,events);
 res.status(202).json({success:true,data:result});
}));
router.get('/catalog',authenticate,asyncHandler(async(req,res)=>res.json({success:true,data:await store.catalog({numOfDays:req.query.numOfDays,exportId:req.query.exportId})})));
router.post('/heatmap-import',authenticate,authorize('admin','dev'),asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await require('../services/heatmapArchive').save(req.body,req.user.id)})));
router.get('/heatmap-archives',authenticate,asyncHandler(async(req,res)=>res.json({success:true,data:await require('../services/heatmapArchive').compare({...req.query,siteId:Number(req.query.siteId)})})));
router.post('/discover',authenticate,authorize('admin','dev'),asyncHandler(async(req,res)=>{
 if(!Number.isInteger(req.body.siteId)||req.body.siteId<1)invalid('Invalid site');
 res.json({success:true,data:await pageCatalog.discover(req.body.siteId)});
}));
router.post('/snapshot',authenticate,authorize('admin','dev'),asyncHandler(async(req,res)=>{
 const {siteId,path:pagePath,device,width}=req.body;
 res.json({success:true,data:await require('../services/snapshotCapture').capture({siteId,pagePath,device,width})});
}));
router.post('/pages',authenticate,authorize('admin','dev'),asyncHandler(async(req,res)=>{
 const {siteId,url,title,category}=req.body;let u;try{u=new URL(url);}catch{invalid('Invalid page URL');}
 if(!Number.isInteger(siteId)||typeof title!=='string'||!title.trim()||title.length>255||typeof category!=='string'||!category.trim()||category.length>100||u.search||u.hash||u.username||u.password)invalid('Invalid page configuration');
 const sites=await query('SELECT origin FROM tracking_sites WHERE id=?',[siteId]);if(!sites[0]||sites[0].origin!==u.origin)invalid('Page URL must belong to selected site');
 const pagePath=cleanPath(u.pathname);
 const r=await query('INSERT INTO tracked_pages(site_id,page_path,title,category) VALUES (?,?,?,?)',[siteId,pagePath,title.trim(),category.trim()]);
 res.status(201).json({success:true,data:{id:r.insertId}});
}));
function options(req) {
 const {siteId,path,monthA,monthB,startA,endA,startB,endB,device,version,width}=req.query;
 const versionB=req.query.versionB||version,widthB=req.query.widthB||width;
 if(!/^\d+$/.test(siteId||'') || !['desktop','tablet','mobile'].includes(device) || !/^[a-zA-Z0-9_.:-]{1,80}$/.test(version||'') || !/^\d+$/.test(width||'') || +width<100 || +width>10000)invalid('Select a site, device, layout and viewport width');
 cleanPath(path);
 // Accept either date range (startA+endA) or legacy month (monthA), not both for the same period.
 const useDateRangeA=!!(startA&&endA),useDateRangeB=!!(startB&&endB);
 if(monthA&&(startA||endA))invalid('Provide either startA+endA or monthA, not both');
 if(monthB&&(startB||endB))invalid('Provide either startB+endB or monthB, not both');
 let boundsA,boundsB;
 if(useDateRangeA){boundsA=dayBounds(startA,endA);}else if(monthA){boundsA=monthBounds(monthA);}else{invalid('Provide either startA+endA or monthA');}
 if(useDateRangeB){boundsB=dayBounds(startB,endB);}else if(monthB){boundsB=monthBounds(monthB);}else{invalid('Provide either startB+endB or monthB');}
 if(!/^[a-zA-Z0-9_.:-]{1,80}$/.test(versionB||'')||!/^\d+$/.test(widthB||'')||+widthB<100||+widthB>10000)invalid('Invalid comparison layout');
 return {siteId:+siteId,path,monthA:boundsA.month||null,startA:boundsA.start||null,endA:boundsA.end||null,monthB:boundsB.month||null,startB:boundsB.start||null,endB:boundsB.end||null,device,version,width:+width,versionB,widthB:+widthB,useDateRangeA,useDateRangeB};
}
router.get('/compare',authenticate,asyncHandler(async(req,res)=>{
 const o=options(req);
 const [a,b]=await Promise.all([
  store.report({...o,month:o.monthA,start:o.startA,end:o.endA}),
  store.report({...o,month:o.monthB,start:o.startB,end:o.endB,version:o.versionB,width:o.widthB})
 ]);
 const images=await query('SELECT * FROM page_snapshots WHERE site_id=? AND page_path=? AND device=? ORDER BY captured_at DESC',[o.siteId,o.path,o.device]);
 const snapshots={a:images.find(s=>s.layout_version===o.version&&s.viewport_width===o.width)||null,b:images.find(s=>s.layout_version===o.versionB&&s.viewport_width===o.widthB)||null};
 let geometryWarning=null;
 for(const [key,r] of [['a',a],['b',b]])if(snapshots[key]&&r.geometry.minHeight&&(r.geometry.minHeight!==snapshots[key].document_height||r.geometry.maxHeight!==snapshots[key].document_height)){snapshots[key]=null;geometryWarning='Chiều cao trang đo được khác ảnh tham chiếu. Hiển thị lưới độc lập để tránh gắn điểm chạm vào sai nội dung; dùng tên vùng để đối chiếu.';}
 const stableHeight=(!a.geometry.minHeight||a.geometry.minHeight===a.geometry.maxHeight)&&(!b.geometry.minHeight||b.geometry.minHeight===b.geometry.maxHeight)&&(!a.geometry.minHeight||!b.geometry.minHeight||a.geometry.minHeight===b.geometry.minHeight);
 const comparableGeometry=o.version===o.versionB&&o.width===o.widthB&&stableHeight;
 res.json({success:true,data:{a,b,deltas:comparableGeometry?compare(a,b):[],snapshot:snapshots.a,snapshots,comparableGeometry,geometryWarning,source:'measured',timezone:'Asia/Ho_Chi_Minh',attribution:'Client-confirmed actions within 30 minutes of click; not verified orders'}});
}));
router.get('/notes',authenticate,asyncHandler(async(req,res)=>{
 const siteId=Number(req.query.siteId);const path=cleanPath(req.query.path);
 if(!Number.isInteger(siteId)||siteId<1)invalid('Invalid site');
 const notes=await query('SELECT n.*,u.username FROM behavior_notes n JOIN users u ON u.id=n.created_by WHERE site_id=? AND page_path=? ORDER BY created_at DESC LIMIT 100',[siteId,path]);
 res.json({success:true,data:notes});
}));
router.post('/notes',authenticate,asyncHandler(async(req,res)=>{
 const b=req.body;
 cleanPath(b.path);
 if(!Number.isInteger(b.siteId)||!Number.isInteger(b.col)||b.col<1||b.col>12||!Number.isInteger(b.row)||b.row<1||b.row>4000||typeof b.text!=='string'||!b.text.trim()||b.text.length>2000||!['desktop','tablet','mobile'].includes(b.device)||!/^[a-zA-Z0-9_.:-]{1,80}$/.test(b.version||''))invalid('Invalid improvement note');
 if(b.versionB!==undefined&&!/^[a-zA-Z0-9_.:-]{1,80}$/.test(b.versionB))invalid('Invalid comparison version');
 for(const width of [b.width,b.widthB])if(width!==undefined&&(!Number.isInteger(width)||width<100||width>10000))invalid('Invalid note viewport');
 if(b.period!==undefined&&!['a','b'].includes(b.period))invalid('Invalid selected period');
 // Support date range (startA/endA) or legacy month (monthA)
 let periodA,periodB;
 if(b.startA&&b.endA){const db=dayBounds(b.startA,b.endA);periodA=`${b.startA}~${b.endA}`;}else{periodA=monthBounds(b.monthA).month;}
 if(b.startB&&b.endB){const db=dayBounds(b.startB,b.endB);periodB=`${b.startB}~${b.endB}`;}else{periodB=monthBounds(b.monthB).month;}
 const r=await query('INSERT INTO behavior_notes(site_id,page_path,device,layout_version,grid_col,grid_row,period_a,period_b,note_text,created_by,viewport_width,layout_version_b,viewport_width_b,selected_period) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[b.siteId,b.path,b.device,b.version,b.col,b.row,periodA,periodB,b.text.trim(),req.user.id,b.width||null,b.versionB||b.version,b.widthB||b.width||null,b.period||'a']);
 res.status(201).json({success:true,data:{id:r.insertId}});
}));
router.patch('/notes/:id',authenticate,authorize('admin'),asyncHandler(async(req,res)=>{
 if(!/^\d+$/.test(req.params.id)||!['approved','implemented','rejected','pending'].includes(req.body.status))invalid('Invalid status');
 const r=await query('UPDATE behavior_notes SET status=? WHERE id=?',[req.body.status,req.params.id]);
 if(!r.affectedRows)return res.status(404).json({success:false,message:'Note not found'});
 res.json({success:true});
}));
router.post('/sites',authenticate,authorize('admin'),asyncHandler(async(req,res)=>{
 const {name,origin,goalPaths}=req.body;let u;try{u=new URL(origin);}catch{invalid('Invalid origin');}
 if(u.origin!==origin||!['https:','http:'].includes(u.protocol)||u.username||u.password||typeof name!=='string'||!name.trim()||name.length>120||!Array.isArray(goalPaths)||goalPaths.length>50)invalid('Invalid site configuration');
 if(process.env.NODE_ENV==='production'&&u.protocol!=='https:')invalid('HTTPS origin required');
 goalPaths.forEach(cleanPath);
 const key=require('crypto').randomUUID();
 const r=await query('INSERT INTO tracking_sites(name,origin,public_key,goal_paths) VALUES (?,?,?,?)',[name.trim(),origin,key,JSON.stringify(goalPaths)]);
 res.status(201).json({success:true,data:{id:r.insertId,publicKey:key}});
}));
module.exports={router,collector};
