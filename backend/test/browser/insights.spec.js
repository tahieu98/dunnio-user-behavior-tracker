const {test,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const fs=require('fs'),path=require('path');
const tracker=fs.readFileSync(path.resolve(__dirname,'../../../tracker/behavior-tracker.js'),'utf8');
const qaDir=path.resolve(__dirname,'../../../.local/qa');
test('demo comparisons, grid details, filters, keyboard, CSV and responsive accessibility',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await page.goto('/analysis.html?demo=1');
 await expect(page.locator('#mapA svg')).toBeVisible();await expect(page.locator('#metrics .stat').nth(0).locator('strong')).toHaveText('32');
 await page.getByRole('button',{name:/C5 · R34/}).click();await expect(page.locator('#cellTitle')).toContainText('C5 · R34');
 await page.getByRole('button',{name:'Hành động',exact:true}).click();await expect(page.locator('[data-metric=actions]')).toHaveClass('selected');
 await page.getByRole('button',{name:'Chênh lệch A − B'}).click();await expect(page.locator('#legend')).toContainText('Tăng ở A');
 await page.locator('#mapA svg').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await expect(page.locator('#cellTitle')).toContainText('C6');
 const download=page.waitForEvent('download');await page.locator('#export').click();expect((await download).suggestedFilename()).toContain('DEMO.csv');
 const desktopAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(desktopAxe.violations).toEqual([]);
 fs.mkdirSync(qaDir,{recursive:true});await page.getByRole('button',{name:'Điểm chạm',exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(qaDir,'desktop.png'),fullPage:true});
 await page.selectOption('#device','mobile');await expect(page.locator('#export')).toBeDisabled();await page.locator('#apply').click();await expect(page.locator('#mapA svg')).toBeVisible();await expect(page.locator('#mapStatsA')).toContainText('32 xem');
 await page.selectOption('#zoom','2.5');await expect(page.locator('#mapA')).toHaveCSS('width',/px$/);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const mobileAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(mobileAxe.violations).toEqual([]);
 await page.screenshot({path:path.join(qaDir,'mobile.png'),fullPage:true});expect(errors).toEqual([]);
 // Empty months keep the report honest and remove stale heat.
 await page.fill('#monthA','2025-01');await page.locator('#apply').click();await expect(page.locator('#mapStatsA')).toContainText('0 xem');await expect(page.locator('#metrics .stat').first().locator('strong')).toHaveText('0');
});
test('login stores a session token and opens the measured dashboard',async({page})=>{
 test.skip(!process.env.INITIAL_ADMIN_PASSWORD,'Requires provisioned local admin');
 await page.goto('/login.html');await page.fill('#username','admin');await page.fill('#password',process.env.INITIAL_ADMIN_PASSWORD);await page.click('#loginBtn');
 await expect(page).toHaveURL(/analysis\.html$/);await expect(page.locator('#sourceLabel')).toContainText('Clarity API');
 expect(await page.evaluate(()=>!!sessionStorage.getItem('auth_token'))).toBe(true);expect(await page.evaluate(()=>localStorage.getItem('auth_token'))).toBeNull();
 await page.locator('#logout').click();await expect(page).toHaveURL(/login\.html$/);expect(await page.evaluate(()=>sessionStorage.getItem('auth_token'))).toBeNull();
});
test('different revisions use separate snapshots and compare stable regions',async({page})=>{
 const original=require('../../src/services/demoData');
 const c=original.catalog();c.layouts.push({...c.layouts[0],layout_version:'revised-v2',viewport_width:1280,image_path:null});
 await page.route('**/api/demo/catalog',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:c})}));
 await page.route('**/api/demo/compare?**',r=>{
  const q=Object.fromEntries(new URL(r.request().url()).searchParams),data=original.report(q);
  if(q.versionB==='revised-v2'){data.comparableGeometry=false;data.deltas=[];data.snapshots.b=null;data.b.summary.clicks=8;}
  return r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});
 });
 await page.goto('/analysis.html?demo=1');await expect(page.locator('#mapA svg')).toBeVisible();await page.selectOption('#layoutB','revised-v2|1280');await page.locator('#apply').click();
 await expect(page.locator('[data-metric=delta]')).toBeDisabled();await expect(page.locator('#sampleWarning')).toContainText('đối chiếu theo tên vùng');await expect(page.locator('#mapB .no-snapshot')).toBeVisible();await expect(page.locator('#regionRows')).toContainText('navy-cta');
 const download=page.waitForEvent('download');await page.click('#export');const file=await (await download).path();expect(fs.readFileSync(file,'utf8')).toContain('"region"');
});
test('authenticated empty state, safe notes and role-bound workflow',async({page,request})=>{
 test.skip(!process.env.INITIAL_ADMIN_PASSWORD,'Requires provisioned local admin');
 const response=await request.post('/api/auth/login',{data:{username:'admin',password:process.env.INITIAL_ADMIN_PASSWORD}});expect(response.ok()).toBe(true);const data=await response.json();
 await page.addInitScript(t=>localStorage.setItem('auth_token',t),data.data.token);await page.goto('/analysis.html');
 await expect(page.locator('#sourceLabel')).toContainText('Clarity API');await expect(page.locator('#metrics .stat').first().locator('strong')).toHaveText('—');await expect(page.locator('#dataNotice')).toContainText('Kho tracker riêng');
 await page.locator('#mapA svg').focus();await page.keyboard.press('Enter');await expect(page.locator('#saveNote')).toBeEnabled();
 const note=`<img src=x onerror=alert(1)> test QA ${require('crypto').randomUUID()}`;await page.fill('#noteText',note);await page.locator('#saveNote').click();await expect(page.locator('#notes .note').filter({hasText:note})).toBeVisible();expect(await page.locator('#notes img').count()).toBe(0);
 const row=page.locator('#notes .note').filter({hasText:note});await row.locator('select').selectOption('approved');await expect(page.locator('#message')).toContainText('Đã cập nhật');
 // Cleanup this exact test-created note.
 const notes=await request.get('/api/behavior/notes?siteId=1&path=%2Fblog%2Fwhat-suit-color-to-choose.html',{headers:{Authorization:`Bearer ${data.data.token}`}});const id=(await notes.json()).data.find(n=>n.note_text===note)?.id;
 if(id){const {query,pool}=require('../../src/config/database');await query('DELETE FROM behavior_notes WHERE id=?',[id]);await pool.end();}
});
test('legacy page and code-preview templates escape stored markup',async({page,request})=>{
 test.skip(!process.env.INITIAL_ADMIN_PASSWORD,'Requires provisioned local admin');
 const login=await request.post('/api/auth/login',{data:{username:'admin',password:process.env.INITIAL_ADMIN_PASSWORD}});const data=await login.json();
 await page.addInitScript(t=>localStorage.setItem('auth_token',t),data.data.token);await page.goto('/dashboard.html');
 const malicious='<img src=x onerror="window.__legacyXss=1">';
 await page.evaluate(text=>renderPages([{id:1,title:text,url:text,category:text,is_3d_demo:false}]),malicious);
 await expect(page.locator('#pagesGrid img')).toHaveCount(0);expect(await page.evaluate(()=>window.__legacyXss)).toBeUndefined();
 await page.route('**/api/cta/99999',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:{id:99999,page_title:malicious,suggestion_title:malicious,suggestion_text:malicious,suggestion_code:malicious,suggestion_type:'cta_button',status:'pending',grid_col:1,grid_row:1,priority:1}})}));
 await page.evaluate(()=>showSuggestionDetail(99999));await expect(page.locator('#modalBody img')).toHaveCount(0);await expect(page.locator('#modalBody pre')).toHaveText(malicious);
});
test('tracker honors consent, privacy, true coordinates, retry IDs, navigation and explicit action success',async({page})=>{
 const batches=[];let fail=true;
 await page.route('https://tracker.test/api/tracker/events',async r=>{
  const p=r.request().postDataJSON();batches.push(p);
  await r.fulfill({status:fail?500:202,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://dunniotailor.com'},body:JSON.stringify({success:!fail})});
 });
 await page.route('https://dunniotailor.com/**',async r=>{
  if(r.request().url().endsWith('/tracker.js'))return r.fulfill({contentType:'text/javascript',body:tracker});
  const cfg={apiEndpoint:'https://tracker.test/api',siteKey:'dunnio-public-v1',layoutVersion:'fixture-v1',consent:false,allowedPaths:['/fixture','/men/custom-suits'],goalPaths:['/men/custom-suits']};
  await r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><title>Fixture</title></head><body><script>window.TRACKER_CONFIG=${JSON.stringify(cfg)}</script><div style="height:1200px" data-track-region="intro">Intro</div><section data-track-region="cta"><button data-track-key="submit"><svg width="20" height="20"><rect width="20" height="20"/></svg> Submit</button><button data-track-key="other">Other</button><a href="/men/custom-suits?email=private@example.com" data-track-key="design">Design</a><input value="PII" /><div data-track-private><button>Private</button></div></section><script src="/tracker.js"></script></body></html>`});
 });
 await page.goto('https://dunniotailor.com/fixture');await page.getByRole('button',{name:'Submit'}).click();await page.evaluate(()=>dunnioTracker.flush());expect(batches).toHaveLength(0);
 await page.evaluate(()=>dunnioTracker.setConsent(true));await page.getByRole('button',{name:'Submit'}).click();
 const sourceId=await page.evaluate(()=>dunnioTracker.getLastClickId());await page.getByRole('button',{name:'Other'}).click();
 await page.evaluate(()=>dunnioTracker.flush());const failedIds=batches[0].events.map(e=>e.id);fail=false;await page.evaluate(()=>dunnioTracker.flush());expect(batches[1].events.map(e=>e.id)).toEqual(failedIds);
 const click=batches[1].events.find(e=>e.id===sourceId);expect(click.y).toBeGreaterThan(1200);expect(click.region).toBe('cta');expect(click.elementKey).toBe('submit');expect(click.elementText).toBeUndefined();expect(click.elementId).toBeUndefined();
 await page.getByRole('textbox').click();await page.getByRole('button',{name:'Private',exact:true}).click();
 await page.evaluate(id=>dunnioTracker.trackAction('form_success',id),sourceId);await expect.poll(()=>batches.flatMap(b=>b.events).some(e=>e.actionName==='form_success'&&e.sourceEventId===sourceId)).toBe(true);
 expect(batches.flatMap(b=>b.events).filter(e=>e.type==='click').every(e=>e.elementKey!=='Private')).toBe(true);
 await page.getByRole('link',{name:'Design'}).click();await page.waitForURL('**/men/custom-suits?email=*');await page.evaluate(()=>{dunnioTracker.setConsent(true);return dunnioTracker.flush();});
 const navigation=batches.flatMap(b=>b.events).find(e=>e.actionName==='navigation');expect(navigation).toBeTruthy();expect(navigation.pagePath).toBe('/fixture');expect(navigation.targetPath).toBe('/men/custom-suits');expect(JSON.stringify(batches)).not.toContain('private@example.com');
 await page.evaluate(()=>dunnioTracker.setConsent(false));const before=batches.length;await page.getByRole('button',{name:'Other'}).click();await page.evaluate(()=>dunnioTracker.flush());expect(batches.length).toBe(before);
});
