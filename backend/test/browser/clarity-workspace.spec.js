'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const {query,pool}=require('../../src/config/database'),{generateToken}=require('../../src/middleware/auth');
const suffix=crypto.randomBytes(6).toString('hex'),fixturePath=`/__clarity_browser_${suffix}`,users=[];
test.describe.configure({mode:'serial'});
let runId,adminToken,editorToken,ids=[],imageFile;
test.beforeAll(async()=>{
 for(const role of ['admin','editor']){const username=`clarity_browser_${role}_${suffix}`,r=await query('INSERT INTO users(username,email,password_hash,role) VALUES (?,?,?,?)',[username,username+'@example.test','TEST-FIXTURE-NOT-A-LOGIN',role]);users.push({id:r.insertId,username,role});}
 adminToken=generateToken(users[0]);editorToken=generateToken(users[1]);
 await query('INSERT INTO tracked_pages(site_id,page_path,title,category) VALUES (1,?,?,?)',[fixturePath,'Clarity browser QA fixture','other']);
});
test.afterAll(async()=>{
 if(runId){await query('DELETE FROM clarity_collection_jobs WHERE run_id=?',[runId]);await query('DELETE FROM clarity_collection_runs WHERE id=?',[runId]);}
 await query('DELETE FROM clarity_heatmap_reports WHERE page_path=?',[fixturePath]);await query('DELETE FROM tracked_pages WHERE page_path=?',[fixturePath]);
 for(const u of users)await query('DELETE FROM users WHERE id=?',[u.id]);
 if(imageFile){const base=path.resolve(__dirname,'../../../.local/clarity-qa/snapshots'),file=path.resolve(base,path.basename(imageFile));if(file.startsWith(base+path.sep))await fs.promises.unlink(file).catch(()=>{});}
 await pool.end();
});
async function login(page,token){await page.addInitScript(t=>sessionStorage.setItem('auth_token',t),token);await page.setViewportSize({width:1440,height:1000});await page.goto('/analysis.html');await expect(page.locator('#site option')).not.toHaveCount(0);await page.selectOption('#site','1');await page.selectOption('#page',fixturePath);await expect(page.locator('#reportCount')).toContainText('bản');}
test('four-period collection → CSV/PNG imports → grouped trends → confirmed image anchor',async({page,request})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await login(page,adminToken);
 await page.fill('#projectId','browser-qa');await page.fill('#pageSearch',fixturePath);await page.locator('.page-item input').check();
 for(let i=0;i<4;i++){const m=String(i+5).padStart(2,'0'),inputs=page.locator('.period-row').nth(i).locator('input');await inputs.nth(0).fill(`2026-${m}-01`);await inputs.nth(1).fill(`2026-${m}-${i===1?30:31}`);}
 await page.locator('#createRun').click();await expect(page.locator('#message')).toContainText('Đã tạo 4 mục');runId=Number(await page.locator('#run').inputValue());
 await page.locator('#jobRows tr').first().getByRole('button',{name:'Mở mục',exact:true}).click();await expect(page.locator('#jobInstructions')).toContainText('2026-05-01');await expect(page.locator('#portalLink')).toHaveAttribute('href','https://clarity.microsoft.com/projects/view/browser-qa/heatmaps');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=1400;const ctx=c.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,600,1400);ctx.fillStyle='#172c42';ctx.font='26px Arial';ctx.fillText('QA fixture · suit color guide',30,70);ctx.fillStyle='#e7f4f5';ctx.fillRect(30,110,540,800);return c.toDataURL('image/png').split(',')[1];});
 for(let i=0;i<4;i++){
  await page.locator('#jobRows tr').nth(i).getByRole('button',{name:'Nhập file',exact:true}).click();await expect(page.locator('#importJob')).toContainText('Mục #');
  const csv=`Selector,Clicks\nimg.guide,${[10,20,35,25][i]}\nbutton.cta,${[2,0,5,10][i]}`;
  await page.locator('[name=csvFile]').setInputFiles({name:`QA-${i}.csv`,mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.locator('[name=pngFile]').setInputFiles({name:'QA-FIXTURE.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('[name=pageviews]').fill(i===3?'300':'100');await page.locator('[name=complete]').check();await page.locator('[name=confirmed]').check();
  await page.locator('#importForm [type=submit]').click();await expect(page.locator('#message')).toContainText('Đã lưu bản #');await expect(page.locator('#reportRows tr')).toHaveCount(i+1);
 }
 await expect(page.locator('#runProgress')).toContainText('4/4 đã nhập');
 const response=await request.get('/api/clarity-workspace/reports?'+new URLSearchParams({siteId:1,path:fixturePath,device:'mobile'}),{headers:{Authorization:`Bearer ${adminToken}`}});const rs=(await response.json()).data;ids=rs.map(r=>r.id);imageFile=rs[0].image_path;
 for(const input of await page.locator('#reportRows input').all())await input.check();await page.locator('#compare').click();await expect(page.locator('#trendTable')).toContainText('img.guide');await expect(page.locator('#trendTable')).toContainText('+150%');
 await page.getByText('So sánh tổng nhiều khoảng · ví dụ tháng 5–6 với tháng 7–8',{exact:true}).click();await page.selectOption('#groupA',ids.slice(0,2).map(String));await page.selectOption('#groupB',ids.slice(2).map(String));await page.locator('#compareGroups').click();await expect(page.locator('#trendTable thead')).toContainText('Tổng nhóm A');await expect(page.locator('#trendTable')).toContainText('+100%');
 await page.getByRole('button',{name:'img.guide',exact:true}).click();await page.locator('#armAnchor').click();await page.locator('#mapA img').click({position:{x:100,y:100}});await page.fill('#anchorLabel','Suit color guide');await page.locator('#anchorConfirmed').check();await page.locator('#saveAnchor').click();await expect(page.locator('#message')).toContainText('Đã lưu điểm neo');await expect(page.locator('#mapA .anchor-bubble')).toHaveCount(1);
 const full=await request.get('/api/clarity-workspace/reports/'+ids[0],{headers:{Authorization:`Bearer ${adminToken}`}});const saved=(await full.json()).data;expect(saved.anchors[0].source).toBe('analyst-confirmed');expect(saved.anchors[0].label).toBe('Suit color guide');expect(saved.image_width).toBe(600);
 const dimensions=await page.locator('#mapA img').evaluate(i=>({w:i.clientWidth,h:i.clientHeight,nw:i.naturalWidth,nh:i.naturalHeight}));expect(Math.abs(dimensions.w/dimensions.h-dimensions.nw/dimensions.nh)).toBeLessThan(.01);
 // Download is verified in the next test; this screenshot uses fixture data only.
 const qa=path.resolve(__dirname,'../../../.local/qa');fs.mkdirSync(qa,{recursive:true});await page.screenshot({path:path.join(qa,'clarity-workspace-desktop.png'),fullPage:true});await page.locator('#comparison').screenshot({path:path.join(qa,'clarity-workspace-comparison.png')});
 expect(errors).toEqual([]);const violations=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(violations.violations).toEqual([]);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:path.join(qa,'clarity-workspace-mobile.png'),fullPage:true});
});
test('editor can compare and download originals, but cannot import or mark anchors',async({page})=>{
 await login(page,editorToken);await expect(page.locator('#importForm [type=submit]')).toBeDisabled();await expect(page.locator('#createRun')).toBeDisabled();
 await expect(page.locator('#reportRows input')).toHaveCount(4);
 for(const input of await page.locator('#reportRows input').all())await input.check();await page.locator('#compare').click();await expect(page.locator('#trendTable')).toContainText('img.guide');
 await page.getByRole('button',{name:'img.guide',exact:true}).click();await expect(page.locator('#armAnchor')).toBeDisabled();
 const [csv]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);expect(csv.suggestedFilename()).toMatch(/^Dunnio-Clarity-/);
 const [original]=await Promise.all([page.waitForEvent('download'),page.locator('#reportRows tr').first().getByRole('button',{name:'CSV gốc'}).click()]);const stream=await original.createReadStream();let raw='';for await(const bytes of stream)raw+=bytes.toString();expect(raw).toContain('img.guide,10');
});
