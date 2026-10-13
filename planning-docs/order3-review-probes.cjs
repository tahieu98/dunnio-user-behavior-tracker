'use strict';
const {chromium}=require('../backend/node_modules/playwright-core');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
const received=[];let cfg;
const server=http.createServer((req,res)=>{if(req.url==='/touch-tracker.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.resolve(__dirname,'../tracker/touch-tracker.js')));}if(req.url==='/api/tracker/touch'){let b='';req.on('data',s=>b+=s);req.on('end',()=>{received.push(JSON.parse(b));res.writeHead(202,{'Content-Type':'application/json'});res.end('{"success":true}');});return;}res.setHeader('Content-Type','text/html');res.end('<!doctype html><body style="height:1000px"><button data-track-key="test">Test</button><script>window.DUNNIO_TOUCH_CONFIG='+JSON.stringify(cfg)+'</script><script src="/touch-tracker.js"></script></body>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true});try{
cfg={apiEndpoint:origin+'/api',siteKey:'probe',layoutVersion:'v1',consent:true,allowedPaths:['/public'],sampleRate:1};const page=await browser.newPage({viewport:{width:1000,height:700}});await page.goto(origin+'/public');await page.evaluate(()=>dunnioTouch.flush());
await page.setViewportSize({width:1000,height:600});await page.evaluate(()=>dispatchEvent(new Event('resize')));await page.evaluate(()=>dunnioTouch.flush());
await page.evaluate(()=>{document.body.style.height='1500px';history.replaceState({},'','/public');});await page.evaluate(()=>dunnioTouch.flush());
const results={geometryChanges:{navigations:1,pageviews:received.flatMap(b=>b.entries).filter(e=>e.type==='pageview').reduce((n,e)=>n+e.count,0),contexts:received.map(b=>b.context)}};
await page.close();cfg={...cfg,sampleRate:.000123};const p=await browser.newPage();await p.goto(origin+'/public');results.sampleRate=await p.evaluate(()=>dunnioTouch.getState());console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
