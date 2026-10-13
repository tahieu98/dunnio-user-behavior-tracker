'use strict';
const {query}=require('../config/database');
const {cleanPath,invalid}=require('./behaviorMath');
const aliases=h=>h.toLowerCase().replace(/^www\./,'');
function sameOrigin(a,b){try{const x=new URL(a),y=new URL(b);return x.protocol===y.protocol&&x.port===y.port&&aliases(x.hostname)===aliases(y.hostname);}catch{return false;}}
function pagePath(value,origin){
 try{const u=new URL(value,origin);if(!sameOrigin(u.origin,origin)||u.username||u.password)return null;
 const decoded=decodeURIComponent(u.pathname);if(/[<>]/.test(decoded)||/\.(jpg|png|gif|webp|svg|pdf|css|js|xml|txt|woff2?)$/i.test(decoded))return null;
 return cleanPath(u.pathname);
 }catch{return null;}
}
function typeOf(path,goals=[]){
 if(path==='/')return 'home';
 if(['/blog','/blog/','/blog/stylists-advice','/blog/tailors-advice'].includes(path.replace(/\/$/,'')))return 'blog-category';
 if(path.startsWith('/blog/'))return 'blog-article';
 if(goals.includes(path)||path.startsWith('/3d-custom-outfit/')||/^\/(men|women)\/custom-[^/]+$/.test(path))return 'service';
 if(/^\/(men|women)(\/|$)/.test(path))return 'product-category';
 if(path.endsWith('.html')&&!/shipping|privacy|terms|about|contact|faq/i.test(path))return 'product';
 return 'other';
}
function titleOf(path){return path==='/'?'Dunnio Tailor · Trang chủ':decodeURIComponent(path.split('/').filter(Boolean).at(-1)).replace(/\.html$/,'').replace(/[-_]/g,' ').slice(0,255);}
async function register(site,paths,category='discovered'){
 let added=0;const unique=[...new Set(paths)].slice(0,10000);
 for(let i=0;i<unique.length;i+=200){const batch=unique.slice(i,i+200);
  const result=await query(`INSERT IGNORE INTO tracked_pages(site_id,page_path,title,category) VALUES ${batch.map(()=>'(?,?,?,?)').join(',')}`,batch.flatMap(p=>[site.id,p,titleOf(p),category]));added+=result.affectedRows;
 }return added;
}
// Restrict discovery to the public Dunnio origin. No arbitrary URL fetch or internal network proxy.
async function discover(siteId){
 const site=(await query('SELECT * FROM tracking_sites WHERE id=?',[siteId]))[0];
 if(!site||site.origin!=='https://dunniotailor.com')invalid('Discovery currently supports https://dunniotailor.com only');
 const response=await fetch(site.origin+'/sitemap.xml',{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Sitemap HTTP ${response.status}`);
 const text=await response.text();if(text.length>5000000)invalid('Sitemap too large');
 const paths=[...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m=>pagePath(m[1].replace(/&amp;/g,'&'),site.origin)).filter(Boolean);
 if(!paths.length)throw new Error('No public URLs found in sitemap');
 paths.push('/','/blog','/blog/stylists-advice','/blog/tailors-advice');
 const added=await register(site,paths,'sitemap');return {added,discovered:new Set(paths).size,source:site.origin+'/sitemap.xml'};
}
async function latestClarity({numOfDays,exportId}={}){
 const project=process.env.CLARITY_PROJECT_ID;
 if(!project)return null;
 if(numOfDays!==undefined&&![1,2,3].includes(Number(numOfDays)))invalid('Select a 1–3 day API window');
 if(exportId!==undefined&&(!Number.isInteger(Number(exportId))||Number(exportId)<1))invalid('Invalid export ID');
 const filter=exportId!==undefined?' AND id=?':numOfDays!==undefined?' AND num_of_days=?':'';
 const rows=await query("SELECT id,project_id,requested_at,num_of_days,dimensions,payload FROM clarity_exports WHERE project_id=? AND status='completed' AND FIND_IN_SET('URL',dimensions)>0"+filter+' ORDER BY id DESC LIMIT 1',[project,...(exportId!==undefined?[Number(exportId)]:numOfDays!==undefined?[Number(numOfDays)]:[])]);
 if(!rows.length)return null;const r=rows[0];
 return {...r,payload:typeof r.payload==='string'?JSON.parse(r.payload):r.payload};
}
function urlMetrics(payload,origin){
 const map=new Map();
 for(const group of Array.isArray(payload)?payload:[]){
  for(const item of group.information||[]){
   const value=item.Url||item.URL||item.url,path=pagePath(value,origin);if(!value||!path)continue;
   if(!map.has(path))map.set(path,{metrics:{},urlVariants:new Set()});
   const row=map.get(path);row.urlVariants.add(new URL(value).origin+new URL(value).pathname);
   // Preserve separately returned alias rows. Never sum percentages, averages or sessions across URLs.
   if(!row.metrics[group.metricName])row.metrics[group.metricName]=[];
   const values={...item,urlVariant:new URL(value).origin+new URL(value).pathname};delete values.Url;delete values.URL;delete values.url;
   row.metrics[group.metricName].push(values);
  }
 }
 return map;
}
async function enrich(sites,pages,options){
 const archive=await latestClarity(options);
 const all=[];
 for(const site of sites){
  const map=urlMetrics(archive?.payload,site.origin),goals=typeof site.goal_paths==='string'?JSON.parse(site.goal_paths):site.goal_paths;
  await register(site,[...map.keys()],'clarity');
  const rows=await query('SELECT p.id,p.site_id,p.page_path url_path,p.title,CONCAT(?,p.page_path) url,p.category FROM tracked_pages p WHERE site_id=? AND is_tracked=TRUE',[site.origin,site.id]);
  for(const p of rows){const m=map.get(p.url_path);all.push({...p,content_type:typeOf(p.url_path,goals),is_goal:goals.includes(p.url_path),clarity:m?{metrics:m.metrics,urlVariants:[...m.urlVariants]}:null});}
 }
 const at=archive?.requested_at?new Date(archive.requested_at.replace(' ','T')+'Z'):null;
 return {pages:all,clarity:archive?{id:archive.id,projectId:archive.project_id,fetchedAt:at.toISOString(),windowStart:new Date(at.getTime()-archive.num_of_days*86400000).toISOString(),numOfDays:archive.num_of_days,dimensions:archive.dimensions.split(','),source:'clarity-export',timezone:'UTC',coordinateData:false,monthlyHistory:false,maxRows:1000,possibleTruncation:archive.payload.some(m=>(m.information?.length||0)>=1000)}:null};
}
module.exports={sameOrigin,pagePath,typeOf,titleOf,register,discover,urlMetrics,enrich};
