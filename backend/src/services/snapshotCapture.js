'use strict';
const {chromium}=require('playwright-core');
const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const {query}=require('../config/database');
const {cleanPath,invalid}=require('./behaviorMath');
let busy=false,activeBrowser=null,cancelling=false;
async function cancel(){cancelling=true;await activeBrowser?.close().catch(()=>{});}
const assetDirectory=()=>process.env.DESKTOP_DATA_ROOT?path.resolve(process.env.DESKTOP_DATA_ROOT,'snapshots'):path.resolve(__dirname,'../../../frontend/snapshots');
async function writeAsset(file,bytes){
 const dir=assetDirectory();await fs.mkdir(dir,{recursive:true});
 const destination=path.join(dir,file);
 try{await fs.access(destination);return;}catch(e){if(e.code!=='ENOENT')throw e;}
 const temporary=path.join(process.env.DESKTOP_RUN_ROOT||dir,`asset-${crypto.randomUUID()}.partial`);
 try{await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.rename(temporary,destination);}finally{await fs.unlink(temporary).catch(()=>{});}
}
async function capture({siteId,pagePath,device='desktop',width=1440,version}){
 cleanPath(pagePath);
 if(!Number.isInteger(siteId)||!['desktop','mobile','tablet'].includes(device)||!Number.isInteger(width)||width<320||width>2560)invalid('Invalid capture settings');
 const site=(await query('SELECT origin FROM tracking_sites WHERE id=?',[siteId]))[0];
 if(!site||site.origin!=='https://dunniotailor.com')invalid('Capture currently supports public Dunnio pages only');
 const pages=await query('SELECT id FROM tracked_pages WHERE site_id=? AND page_path=?',[siteId,pagePath]);if(!pages.length)invalid('Register page before capture');
 if(busy){const e=new Error('Một ảnh khác đang được chụp. Vui lòng đợi hoàn tất.');e.statusCode=409;throw e;}
 if(cancelling)throw new Error('Ứng dụng đang đóng');
 busy=true;let browser;const deadline=setTimeout(()=>void activeBrowser?.close().catch(()=>{}),90000);deadline.unref();
 try{
  version=version||`reference-${new Date().toISOString().slice(0,10)}-${crypto.randomBytes(3).toString('hex')}`;
  if(!/^[a-zA-Z0-9_.:-]{1,80}$/.test(version))invalid('Invalid version');
  const existing=await query('SELECT id FROM page_snapshots WHERE site_id=? AND page_path=? AND device=? AND layout_version=? AND viewport_width=?',[siteId,pagePath,device,version,width]);
  if(existing.length)invalid('Use a new version; historical snapshots are immutable');
  browser=await chromium.launch({...process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'},headless:true});
  activeBrowser=browser;if(cancelling)throw new Error('Đã hủy chụp ảnh khi ứng dụng đóng');
  const context=await browser.newContext({viewport:{width,height:device==='mobile'?844:1000},deviceScaleFactor:1,isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.route(/clarity\.ms|google-analytics\.com|googletagmanager\.com|\/api\/tracker\/events/,r=>r.abort());
  const response=await page.goto(new URL(pagePath,site.origin).href,{waitUntil:'load',timeout:45000});
  if(!response?.ok())throw new Error(`Page capture HTTP ${response?.status()}`);
  if(!require('./pageCatalog').sameOrigin(page.url(),site.origin))throw new Error('Page redirected outside Dunnio');
  await page.evaluate(async()=>{
   const wait=ms=>new Promise(r=>setTimeout(r,ms));await document.fonts.ready;
   let y=0;for(let n=0;n<250&&y<document.documentElement.scrollHeight;n++,y+=Math.floor(innerHeight*.7)){
    scrollTo(0,y);await wait(120);
    await Promise.race([Promise.all([...document.images].filter(i=>{const b=i.getBoundingClientRect();return b.bottom>=0&&b.top<innerHeight;}).map(i=>i.decode().catch(()=>{}))),wait(600)]);
   }
   scrollTo(0,0);await wait(350);
  });
  let height=0,stable=0;
  for(let i=0;i<12&&stable<3;i++){const next=await page.evaluate(()=>document.documentElement.scrollHeight);stable=next===height?stable+1:0;height=next;await page.waitForTimeout(200);}
  const quality=await page.evaluate(()=>({title:document.title,viewportWidth:innerWidth,documentHeight:Math.max(innerHeight,document.documentElement.scrollHeight),failedImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,stylesheets:[...document.styleSheets].length}));
  if(quality.documentHeight>200000||quality.viewportWidth!==width||!quality.stylesheets)throw new Error('Page geometry or CSS is not ready');
  const pixels=await page.screenshot({fullPage:true,animations:'disabled',maskColor:'#dfe4eb',mask:[page.locator('input,textarea,[contenteditable],[data-track-private]')]});
  const pixelWidth=pixels.readUInt32BE(16),pixelHeight=pixels.readUInt32BE(20);
  if(pixelWidth!==width||pixelHeight!==quality.documentHeight)throw new Error('Snapshot pixel dimensions differ from measured document');
  const file=`site-${siteId}-${crypto.createHash('sha256').update(pagePath).digest('hex').slice(0,12)}-${device}-${version.replace(/[^\w.-]/g,'-')}-${width}.png`;
  if(cancelling)throw new Error('Đã hủy chụp ảnh khi ứng dụng đóng');await writeAsset(file,pixels);
  await query('INSERT INTO page_snapshots(site_id,page_path,device,layout_version,viewport_width,document_height,image_path) VALUES (?,?,?,?,?,?,?)',[siteId,pagePath,device,version,width,pixelHeight,`/snapshots/${file}`]);
  await query('UPDATE tracked_pages SET title=? WHERE site_id=? AND page_path=?',[quality.title.slice(0,255),siteId,pagePath]);
  return {version,width,height:pixelHeight,imagePath:`/snapshots/${file}`,quality,source:'current-public-page',historical:false};
 }finally{clearTimeout(deadline);await browser?.close().catch(()=>{});activeBrowser=null;busy=false;}
}
module.exports={capture,assetDirectory,writeAsset,cancel};
