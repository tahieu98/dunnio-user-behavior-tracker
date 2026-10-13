require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const {query,pool}=require('../src/config/database');
const {app}=require('../src/server');
test('measured collector → MySQL → comparison, retries, attribution and authorization',{skip:!process.env.RUN_DB_TESTS},async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}`,path=`/__test_${crypto.randomBytes(6).toString('hex')}`,sessionId=crypto.randomUUID();
 let pageId,userId,extraSiteId;
 async function request(endpoint,body,token,origin){const r=await fetch(url+endpoint,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),headers:r.headers};}
 try{
  const login=await request('/api/auth/login',{username:'admin',password:process.env.INITIAL_ADMIN_PASSWORD});assert.equal(login.status,200);const token=login.body.data.token;
  const page=await query('INSERT INTO tracked_pages(site_id,page_path,title,category) VALUES (?,?,?,?)',[1,path,'Integration test','test']);pageId=page.insertId;
  const common={viewId:crypto.randomUUID(),timestamp:Date.now(),pagePath:path,device:'desktop',layoutVersion:'test-v1',viewportWidth:1440,viewportHeight:1000,documentHeight:45000};
  const click={...common,id:crypto.randomUUID(),type:'click',x:130,y:50000-6000,region:'cta',elementKey:'design-suit',elementText:'PII MUST BE DROPPED'};
  const events=[{...common,id:crypto.randomUUID(),type:'pageview'},click,{...common,id:crypto.randomUUID(),type:'action',actionName:'navigation',sourceEventId:click.id,targetPath:'/men/custom-suits'},{...common,id:crypto.randomUUID(),type:'action',actionName:'form_success',sourceEventId:click.id}];
  const payload={siteKey:'dunnio-public-v1',sessionId,consent:true,events};
  assert.equal((await request('/api/tracker/events',{...payload,consent:false},null,'https://dunniotailor.com')).status,400);
  assert.equal((await request('/api/tracker/events',payload,null,'https://attacker.invalid')).status,403);
  const accepted=await request('/api/tracker/events',payload,null,'https://dunniotailor.com');assert.equal(accepted.status,202);assert.equal(accepted.body.data.inserted,4);assert.equal(accepted.headers.get('access-control-allow-origin'),'https://dunniotailor.com');
  const retry=await request('/api/tracker/events',payload,null,'https://dunniotailor.com');assert.equal(retry.body.data.inserted,0);assert.equal(retry.body.data.duplicates,4);
  const sql=await query('SELECT * FROM behavior_events WHERE page_path=?',[path]);assert.equal(sql.length,4);assert.equal(sql[1].grid_row,881);assert.equal(sql[1].element_text,undefined);assert.notEqual(sql[0].session_hash,sessionId);
  const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date()).replace('/','-');
  const params=new URLSearchParams({siteId:1,path,device:'desktop',version:'test-v1',width:1440,monthA:month,monthB:'2026-08'});
  assert.equal((await request(`/api/behavior/compare?${params}`)).status,401);
  const result=await request(`/api/behavior/compare?${params}`,null,token);assert.equal(result.status,200);assert.equal(result.body.data.a.summary.clicks,1);assert.equal(result.body.data.a.summary.actions,1);assert.equal(result.body.data.a.summary.actionRate,100);
  assert.equal(result.body.data.a.outcomes.find(o=>o.name==='navigation').targetPath,'/men/custom-suits');
  const different=new URLSearchParams(params);different.set('versionB','test-v2');different.set('widthB','1280');
  const revised=await request(`/api/behavior/compare?${different}`,null,token);assert.equal(revised.status,200);assert.equal(revised.body.data.comparableGeometry,false);assert.deepEqual(revised.body.data.deltas,[]);assert.equal(revised.body.data.a.regions[0].key,'cta');
  // The same path can exist on independent sites.
  const site=await request('/api/behavior/sites',{name:'Test site',origin:`https://${crypto.randomBytes(5).toString('hex')}.example.invalid`,goalPaths:['/goal']},token);assert.equal(site.status,201);extraSiteId=site.body.data.id;
  const origins=await query('SELECT origin FROM tracking_sites WHERE id=?',[extraSiteId]);
  assert.equal((await request('/api/behavior/pages',{siteId:extraSiteId,url:origins[0].origin+'/',title:'Home on second site',category:'landing'},token)).status,201);
  // An unrelated session cannot claim another session's click.
  const bogus={...events[2],id:crypto.randomUUID()};assert.equal((await request('/api/tracker/events',{...payload,sessionId:crypto.randomUUID(),events:[bogus]},null,'https://dunniotailor.com')).status,202);
  const r2=await request(`/api/behavior/compare?${params}`,null,token);assert.equal(r2.body.data.a.summary.actions,1);
  const username=`editor_${crypto.randomBytes(4).toString('hex')}`;
  const editorPassword=crypto.randomBytes(12).toString('hex');
  const user=await request('/api/auth/register',{username,email:`${username}@example.invalid`,password:editorPassword,role:'editor'},token);userId=user.body.data.id;
  const {generateToken}=require('../src/middleware/auth');const editorToken=generateToken({id:userId,username,role:'editor'});
  const note=await request('/api/behavior/notes',{siteId:1,path,device:'desktop',version:'test-v1',col:2,row:881,monthA:month,monthB:'2026-08',text:'Review CTA'},editorToken);assert.equal(note.status,201);
  const denied=await fetch(`${url}/api/behavior/notes/${note.body.data.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${editorToken}`},body:JSON.stringify({status:'approved'})});assert.equal(denied.status,403);
  assert.equal((await request('/api/behavior/sites',{name:'Bad site',origin:'https://bad.invalid',goalPaths:[]},editorToken)).status,403);
  const newPassword=crypto.randomBytes(12).toString('hex');
  const changed=await fetch(url+'/api/auth/password',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${editorToken}`},body:JSON.stringify({currentPassword:editorPassword,newPassword})});assert.equal(changed.status,200);
  assert.equal((await request('/api/auth/login',{username,password:editorPassword})).status,401);assert.equal((await request('/api/auth/login',{username,password:newPassword})).status,200);
  assert.equal((await request('/api/clarity/sync/all',{numOfDays:30},null)).status,401);
  assert.equal((await request('/api/clarity/sync/all',{numOfDays:1,month:'2026-08'},token)).status,400);
  const huge=await fetch(url+'/api/tracker/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({padding:'x'.repeat(70000)})});assert.equal(huge.status,413);
  // Cache/quota tests use a fake upstream, never a real Clarity credential.
  const clarity=require('../src/services/clarityExport'),originalFetch=global.fetch,projectId=`test-${crypto.randomBytes(5).toString('hex')}`;let calls=0;
  try{
   global.fetch=async()=>{calls++;return {ok:true,json:async()=>[{metricName:'Traffic',information:[{URL:'https://example.com/article?email=private',totalSessionCount:'5'}]}]};};
   const first=await clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:1});const cached=await clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:1});assert.equal(calls,1);assert.deepEqual(cached,first);assert.equal(first[0].information[0].URL,'https://example.com/article');
   await clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:1,dimensions:['URL','Device']});assert.equal(calls,2);await clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:1,dimensions:['URL','Device']});assert.equal(calls,2);
   await assert.rejects(()=>clarity.getLiveInsights('fake-test-token',projectId,{dimensions:['URL','Unknown']}),/dimensions/);
   await assert.rejects(()=>clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:30}),/only 1, 2 or 3 days/);
   await query('DELETE FROM clarity_exports WHERE project_id=?',[projectId]);
   for(let i=0;i<10;i++)await query('INSERT INTO clarity_exports(project_id,num_of_days) VALUES (?,?)',[projectId,1]);
   await assert.rejects(()=>clarity.getLiveInsights('fake-test-token',projectId,{numOfDays:1}),e=>e.statusCode===429);assert.equal(calls,2);
  }finally{global.fetch=originalFetch;await query('DELETE FROM clarity_exports WHERE project_id=?',[projectId]);}
 }finally{
  await query('DELETE FROM behavior_notes WHERE page_path=?',[path]);await query('DELETE FROM behavior_events WHERE page_path=?',[path]);if(pageId)await query('DELETE FROM tracked_pages WHERE id=?',[pageId]);if(extraSiteId){await query('DELETE FROM tracked_pages WHERE site_id=?',[extraSiteId]);await query('DELETE FROM tracking_sites WHERE id=?',[extraSiteId]);}if(userId)await query('DELETE FROM users WHERE id=?',[userId]);await new Promise(r=>server.close(r));await pool.end();
 }
});
