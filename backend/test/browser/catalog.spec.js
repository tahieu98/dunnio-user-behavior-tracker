const {test,expect}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default,crypto=require('crypto'),fs=require('fs'),path=require('path');
test('live catalog distinguishes API traffic, monthly missing data, blog categories and complete fields',async({page,request})=>{
 test.skip(!process.env.INITIAL_ADMIN_PASSWORD);
 const login=await request.post('/api/auth/login',{data:{username:'admin',password:process.env.INITIAL_ADMIN_PASSWORD}}),token=(await login.json()).data.token;
 await page.addInitScript(t=>sessionStorage.setItem('auth_token',t),token);await page.setViewportSize({width:1440,height:1000});await page.goto('/analysis.html');
 await expect(page.locator('#clarityWindow')).toContainText('Clarity Export');await expect(page.locator('#pageCount')).toContainText('trang đã biết');
 await expect(page.locator('#metrics strong').first()).toHaveText('—');await expect(page.locator('#dataNotice')).toBeVisible();
 await page.selectOption('#pageType','blog-category');await expect(page.locator('#page option')).toHaveCount(3);await page.selectOption('#page','/blog/stylists-advice');
 await page.locator('#apply').click();await expect(page.locator('#selectedPagePath')).toHaveText('/blog/stylists-advice');await expect(page.locator('#mapA img')).toBeVisible();
 const dimensions=await page.locator('#mapA img').evaluate(i=>({natural:i.naturalWidth,display:i.clientWidth,height:i.clientHeight,ratio:i.naturalWidth/i.naturalHeight}));expect(Math.abs(dimensions.display/dimensions.height-dimensions.ratio)).toBeLessThan(.01);
 await page.selectOption('#pageType','blog-article');await page.fill('#pageSearch','what-suit-color-to-choose');await expect(page.locator('#page option')).toHaveCount(1);
 await page.locator('#pageCatalog details summary').click();await expect(page.locator('#apiMetricRows')).toContainText('Traffic / totalSessionCount');await expect(page.locator('#apiMetricRows')).toContainText('EngagementTime / activeTime');
 await page.locator('#compareExports').click();await expect(page.locator('#exportWindowNotice')).toContainText('không phải tháng lịch');
 await page.selectOption('#dataSource','archive');await expect(page.locator('#dataNotice')).toContainText('Chưa có PNG Clarity');await expect(page.locator('#mapA img')).toHaveCount(0);await expect(page.locator('[data-metric=actions]')).toBeDisabled();
 await page.selectOption('#dataSource','measured');await expect(page.locator('#dataNotice')).toContainText('Kho tracker riêng');await expect(page.locator('[data-metric=actions]')).toBeEnabled();
 const violations=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(violations.violations).toEqual([]);
 const qa=path.resolve(__dirname,'../../../.local/qa');fs.mkdirSync(qa,{recursive:true});await page.screenshot({path:path.join(qa,'order2-live-desktop.png'),fullPage:false});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('sitewide collector registers an unseen page, draws exact points and imports monthly PNG without invented cell counts',async({page,request})=>{
 test.skip(!process.env.INITIAL_ADMIN_PASSWORD);
 const login=await request.post('/api/auth/login',{data:{username:'admin',password:process.env.INITIAL_ADMIN_PASSWORD}}),token=(await login.json()).data.token;
 const testPath=`/__order2_${crypto.randomBytes(5).toString('hex')}`,now=new Date(),month=now.toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).slice(0,7);
 const connection=await require('mysql2/promise').createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
 const query=async(sql,params)=>(await connection.execute(sql,params))[0];let imagePath=null;
 try{
  const common={pagePath:testPath,viewId:crypto.randomUUID(),timestamp:Date.now(),device:'desktop',layoutVersion:'order2-test',viewportWidth:1200,viewportHeight:800,documentHeight:2000};
  const events=[{...common,id:crypto.randomUUID(),type:'pageview'},...[{x:137,y:625},{x:142,y:630},{x:800,y:625}].map(p=>({...common,...p,id:crypto.randomUUID(),type:'click',region:'content'}))];
  const ingest=await request.post('/api/tracker/events',{headers:{Origin:'https://www.dunniotailor.com'},data:{siteKey:'dunnio-public-v1',sessionId:crypto.randomUUID(),consent:true,events}});expect(ingest.status()).toBe(202);
  await page.addInitScript(t=>sessionStorage.setItem('auth_token',t),token);await page.goto('/analysis.html');await page.fill('#pageSearch',testPath);await page.selectOption('#page',testPath);await page.fill('#monthA',month);await page.fill('#monthB',month);await page.locator('#apply').click();
  await expect(page.locator('#mapA .measured-point[cx="137"]')).toHaveAttribute('cy','625');await expect(page.locator('#mapA .measured-point[cx="137"]')).toHaveAttribute('data-density','2');await expect(page.locator('#mapA .measured-point[cx="800"]')).toHaveAttribute('data-density','1');await expect(page.locator('#mapStatsA')).toContainText('1 xem · 3 chạm');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=2000;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1200,2000);return c.toDataURL('image/png').split(',')[1];});
  const upload=await request.post('/api/behavior/heatmap-import',{headers:{Authorization:`Bearer ${token}`},data:{siteId:1,path:testPath,device:'desktop',month,png,csv:'Selector,Clicks\n[data-track-key=cta],7',name:'TEST-FIXTURE.png',pageviews:10,clicks:7}});expect(upload.status()).toBe(201);
  imagePath=`clarity-${crypto.createHash('sha256').update(Buffer.from(png,'base64')).digest('hex')}.png`;
  const duplicate=await request.post('/api/behavior/heatmap-import',{headers:{Authorization:`Bearer ${token}`},data:{siteId:1,path:testPath,device:'desktop',month,png,name:'TEST-FIXTURE.png'}});expect((await duplicate.json()).data.duplicate).toBe(true);
  await page.selectOption('#dataSource','archive');await expect(page.locator('#mapA img')).toBeVisible();await expect(page.locator('#regionRows')).toContainText('[data-track-key=cta]');await expect(page.locator('#metrics strong').nth(2)).toHaveText('—');
  await page.locator('#mapA svg').focus();await page.keyboard.press('Enter');await expect(page.locator('#cellBody')).toContainText('không có số lượt chạm theo ô');
 }finally{await query('DELETE FROM heatmap_archives WHERE page_path=?',[testPath]);await query('DELETE FROM behavior_events WHERE page_path=?',[testPath]);await query('DELETE FROM tracked_pages WHERE page_path=?',[testPath]);if(imagePath&&!(await query('SELECT id FROM heatmap_archives WHERE image_path=?',[`/snapshots/${imagePath}`])).length)await fs.promises.unlink(path.join(process.env.DESKTOP_DATA_ROOT,'snapshots',imagePath)).catch(()=>{});await connection.end();}
});
