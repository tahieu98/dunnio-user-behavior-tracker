'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const {query,pool}=require('../src/config/database');
const {app}=require('../src/server');
const {generateToken}=require('../src/middleware/auth');
test('Clarity workspace HTTP → MySQL: queue, import, idempotency, filters, groups, original CSV and roles',{skip:!process.env.RUN_DB_TESTS},async t=>{
 const suffix=crypto.randomBytes(6).toString('hex'),paths=[`/__clarity_qa_${suffix}`,`/__clarity_qa_${suffix}_b`],users=[];
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}`;let runId;
 t.after(async()=>{
  if(runId){await query('DELETE FROM clarity_collection_jobs WHERE run_id=?',[runId]);await query('DELETE FROM clarity_collection_runs WHERE id=?',[runId]);}
  await query('DELETE FROM clarity_heatmap_reports WHERE page_path IN (?,?)',paths);await query('DELETE FROM tracked_pages WHERE page_path IN (?,?)',paths);
  for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);
  await new Promise(r=>server.close(r));await pool.end();
 });
 for(const role of ['admin','editor']){
  const username=`clarity_${role}_${suffix}`,u=await query('INSERT INTO users(username,email,password_hash,role) VALUES (?,?,?,?)',[username,username+'@example.test','TEST-FIXTURE-NOT-A-LOGIN',role]);users.push({id:u.insertId,username,role});
 }
 const token=generateToken(users[0]),editor=generateToken(users[1]);
 for(const p of paths)await query('INSERT INTO tracked_pages(site_id,page_path,title,category) VALUES (1,?,?,?)',[p,'Clarity QA fixture','other']);
 async function request(path,body,auth=token,method){const r=await fetch(base+'/api/clarity-workspace'+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
 assert.equal((await request('/catalog',null,null)).status,401);
 const cohort={siteId:1,projectId:'qa-project',device:'mobile',heatmapType:'all-clicks',segment:'',timezone:'Asia/Ho_Chi_Minh'};
 const periods=['05','06','07','08'].map(m=>({start:`2026-${m}-01`,end:`2026-${m}-${m==='06'?30:31}`}));
 assert.equal((await request('/runs',{...cohort,name:'QA',paths,periods},editor)).status,403);
 const created=await request('/runs',{...cohort,name:'QA',paths,periods});assert.equal(created.status,200);runId=created.data.id;assert.equal(created.data.jobs,8);
 const run=(await request('/runs/'+runId)).data;assert.equal(run.execution,'assisted-browser');assert.equal(run.jobs.length,8);assert.ok(run.jobs[0].instructions.includes('2026-05-01'));assert.equal(run.portalUrl,'https://clarity.microsoft.com/projects/view/qa-project/heatmaps');
 const ids=[];
 for(let i=0;i<4;i++){
  const job=run.jobs.find(j=>j.page_path===paths[0]&&j.start_date===periods[i].start);
  const body={...cohort,path:paths[0],...periods[i],name:'QA.csv',csv:`Selector,Clicks\nimg.guide,${[10,20,35,25][i]}`,pageviews:100,completeExport:true,confirmed:true,jobId:job.id};
  if(i===0){assert.equal((await request('/reports',{...body,device:'desktop'})).status,400);assert.equal((await request('/reports',body,editor)).status,403);assert.equal((await request('/reports',{...body,confirmed:false})).status,400);}
  const saved=await request('/reports',body);assert.equal(saved.status,200);ids.push(saved.data.id);
  if(i===0){const duplicate=await request('/reports',body);assert.equal(duplicate.data.id,saved.data.id);assert.equal(duplicate.data.duplicate,true);const original=await request('/reports/'+saved.data.id);assert.equal(original.data.raw_csv,body.csv);assert.equal(original.data.image_path,null);}
 }
 const progress=(await request('/runs/'+runId)).data;assert.equal(progress.jobs.filter(j=>j.status==='imported').length,4);
 const summary=(await request('/compare',{reportIds:ids,groups:{a:ids.slice(0,2),b:ids.slice(2)}})).data;assert.equal(summary.rows[0].grouped.delta,30);assert.equal(summary.rows[0].grouped.percent,100);
 assert.equal((await request('/compare',{reportIds:ids,groups:{a:[ids[0],ids[1]],b:[ids[1],ids[2]]}})).status,400);
 const other=await request('/reports',{...cohort,path:paths[0],...periods[0],device:'desktop',csv:'Selector,Clicks\nimg.guide,99',name:'QA.csv',confirmed:true});assert.equal(other.status,200);
 assert.equal((await request('/compare',{reportIds:[ids[0],other.data.id]})).status,400);
 const unsupported=await request('/reports',{...cohort,path:paths[1],...periods[0],name:'unknown.csv',csv:'x,y\n10,20',confirmed:true});assert.equal(unsupported.data.status,'unsupported');assert.equal((await request('/reports/'+unsupported.data.id)).data.raw_csv,'x,y\n10,20');
 assert.equal((await request('/reports/'+ids[0]+'/anchors',{confirmed:true,anchors:[]},token,'PATCH')).status,400);
 assert.equal((await request('/jobs/'+run.jobs.find(j=>j.page_path===paths[1]).id,{status:'imported'},token,'PATCH')).status,400);
 // Exercise the larger authenticated import parser without exceeding CSV limits.
 const csv='Selector,Clicks\n'+Array.from({length:2000},(_,i)=>`[data-key="fixture-${i}-${'x'.repeat(30)}"],1`).join('\n');
 assert.ok(Buffer.byteLength(csv)>65536);assert.equal((await request('/reports',{...cohort,path:paths[1],...periods[1],name:'large.csv',csv,confirmed:true})).status,200);
 assert.equal((await request('/reports?'+new URLSearchParams({siteId:1,path:paths[0],device:'mobile'}),null,editor)).data.length,4);
});
