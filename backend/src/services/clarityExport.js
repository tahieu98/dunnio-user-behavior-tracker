const {pool,query}=require('../config/database');
const {invalid}=require('./behaviorMath');
function redact(value){
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/url/i.test(k)&&typeof v==='string'?safeUrl(v):redact(v)]));
 return value;
}
function safeUrl(value){try{const u=new URL(value);return u.origin+u.pathname;}catch{return '[redacted]';}}
module.exports={
 async getActiveToken(){
  if(!process.env.CLARITY_API_TOKEN||!process.env.CLARITY_PROJECT_ID||process.env.CLARITY_API_TOKEN.startsWith('your-'))throw new Error('Configure CLARITY_API_TOKEN and CLARITY_PROJECT_ID on the server');
  return {jwt_token:process.env.CLARITY_API_TOKEN,project_id:process.env.CLARITY_PROJECT_ID,project_name:'Dunnio Tailor',expires_at:null};
 },
 async saveToken(){invalid('Store Clarity credentials in server environment, outside the webroot; tokens are not saved by the dashboard');},
 async getLiveInsights(token,projectId,{numOfDays=2,dimensions,dimension1,dimension2,dimension3}={}){
  if(![1,2,3].includes(Number(numOfDays)))invalid('Clarity exports support only 1, 2 or 3 days');
  const dims=dimensions||[dimension1||'URL',dimension2,dimension3].filter(Boolean),allowed=['Browser','Device','Country/Region','OS','Source','Medium','Campaign','Channel','URL'];
  if(!Array.isArray(dims)||dims.length<1||dims.length>3||new Set(dims).size!==dims.length||dims.some(d=>!allowed.includes(d)))invalid('Select 1–3 supported distinct Clarity dimensions');
  const dimensionKey=dims.join(',');
  const c=await pool.getConnection();const lock=`clarity-${projectId}`.slice(0,64);let locked=false;
  try{
   const [l]=await c.execute('SELECT GET_LOCK(?,10) acquired',[lock]);locked=!!l[0].acquired;
   if(!locked)throw new Error('A Clarity export is already running');
   const [cached]=await c.execute("SELECT payload FROM clarity_exports WHERE project_id=? AND num_of_days=? AND dimensions=? AND status='completed' AND requested_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 4 HOUR) ORDER BY id DESC LIMIT 1",[projectId,Number(numOfDays),dimensionKey]);
   if(cached.length)return typeof cached[0].payload==='string'?JSON.parse(cached[0].payload):cached[0].payload;
   const [usage]=await c.execute('SELECT COUNT(*) count FROM clarity_exports WHERE project_id=? AND requested_at>=UTC_DATE()',[projectId]);
   if(usage[0].count>=10){const e=new Error('Clarity daily quota reached (10 requests per project)');e.statusCode=429;throw e;}
   const [log]=await c.execute('INSERT INTO clarity_exports(project_id,num_of_days,dimensions) VALUES (?,?,?)',[projectId,Number(numOfDays),dimensionKey]);
   try{
    const url=new URL('https://www.clarity.ms/export-data/api/v1/project-live-insights');url.searchParams.set('numOfDays',Number(numOfDays));dims.forEach((d,i)=>url.searchParams.set(`dimension${i+1}`,d));
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
    if(!response.ok){const e=new Error(`Clarity returned HTTP ${response.status}`);e.statusCode=response.status===429?429:502;throw e;}
    const payload=redact(await response.json());
    await c.execute("UPDATE clarity_exports SET payload=?,status='completed' WHERE id=?",[JSON.stringify(payload),log.insertId]);return payload;
   }catch(e){await c.execute("UPDATE clarity_exports SET status='failed' WHERE id=?",[log.insertId]);throw e;}
  }finally{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',[lock]);c.release();}
 },
 async syncData(pageId,options){
  const token=await this.getActiveToken();const insights=await this.getLiveInsights(token.jwt_token,token.project_id,options);
  return {success:true,recordsProcessed:insights.length||0,export:await this.getExportMetadata(token.project_id,options),source:'clarity-aggregate',message:'Project export archived. No coordinates are estimated; measured heatmaps use the custom tracker.'};
 },
 async getExportMetadata(projectId,{numOfDays=2,dimensions,dimension1,dimension2,dimension3}={}){
  const key=(dimensions||[dimension1||'URL',dimension2,dimension3].filter(Boolean)).join(',');
  const rows=await query("SELECT id,requested_at,num_of_days,dimensions FROM clarity_exports WHERE project_id=? AND num_of_days=? AND dimensions=? AND status='completed' ORDER BY id DESC LIMIT 1",[projectId,Number(numOfDays),key]);
  const row=rows[0];if(!row)return null;const end=new Date(row.requested_at.replace(' ','T')+'Z');
  return {id:row.id,fetchedAt:end.toISOString(),windowStart:new Date(end.getTime()-row.num_of_days*86400000).toISOString(),numOfDays:row.num_of_days,dimensions:row.dimensions.split(','),timezone:'UTC'};
 },
 async getSyncHistory(limit=10){return query('SELECT id,project_id,requested_at,num_of_days,dimensions,status FROM clarity_exports WHERE project_id=? ORDER BY id DESC LIMIT ?',[process.env.CLARITY_PROJECT_ID||'',Math.min(100,Math.max(1,Number(limit)||10))]);}
};
