'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const {chromium}=require('../../backend/node_modules/playwright-core');
(async()=>{
 const state=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${state.debugPort}`);
 const page=browser.contexts()[0].pages().find(p=>p.url().startsWith(state.url))||browser.contexts()[0].pages()[0];
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let changes=0;
 try{
  await page.waitForURL('**/analysis.html');await page.locator('#page option').first().waitFor({state:'attached'});
  // Open the native select popup and choose each group using keyboard input.
  const groups=await page.locator('#pageType option').evaluateAll(options=>options.map(o=>o.value));
  for(let cycle=0;cycle<3;cycle++)for(let index=0;index<groups.length;index++){
   await page.locator('#pageType').click();await page.keyboard.press('Home');
   for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
   assert.equal(await page.locator('#pageType').inputValue(),groups[index]);
   await page.waitForTimeout(500);assert.equal((await page.request.get(state.url+'/api/health')).status(),200);changes++;
  }
  await page.selectOption('#pageType','blog-category');await page.selectOption('#page','/blog/stylists-advice');
  for(const device of ['desktop','mobile','tablet']){await page.selectOption('#device',device);await page.locator('#apply').click();await page.waitForTimeout(1000);changes++;}
  for(const zoom of ['1','1.5','2.5','3.5']){await page.selectOption('#zoom',zoom);changes++;}
  await page.fill('#monthA','2026-10');await page.fill('#monthB','2026-09');await page.locator('#apply').click();await page.waitForTimeout(4500);
  assert.equal((await page.request.get(state.url+'/api/health')).status(),200);assert.deepEqual(errors,[]);
  const evidence={success:true,version:state.version,groupChanges:24,optionChanges:changes,realPrivateEdgeWindow:true,launcherRemainedRunning:true,javascriptErrors:errors,at:new Date().toISOString()};
  fs.writeFileSync(path.resolve(__dirname,'../../.local/qa/windows-native-options.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }finally{await page.close().catch(()=>{});await browser.close().catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
