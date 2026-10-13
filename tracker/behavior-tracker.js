/** Dunnio measured behavior tracker. No text, input values, IDs, query strings or user agent are collected. */
(()=>{
 'use strict';
 if(window.dunnioTracker)return;
 const cfg={apiEndpoint:'',siteKey:'',layoutVersion:'v1',consent:false,enabled:true,sampleRate:1,scope:'registered',allowedPaths:[],goalPaths:[],...window.TRACKER_CONFIG};
 const key=/^[a-zA-Z0-9_.:-]{1,80}$/;
 const excluded='input,textarea,select,[contenteditable], [data-track-private],#wpadminbar,.cookie-notice,.dunnio-tracker-overlay';
 const path=location.pathname;
 const publicPath=!/(^|\/)(checkout|cart|account|my-account|wp-admin|admin|user|login|search)(\/|$)/i.test(decodeURIComponent(path));
 const allowed=publicPath&&(cfg.scope==='all-public'||Array.isArray(cfg.allowedPaths)&&cfg.allowedPaths.includes(path));
 const optedOut=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 const uuid=()=>crypto.randomUUID();
 const safePath=value=>{try{const u=new URL(value,location.href);return u.protocol===location.protocol&&u.port===location.port&&u.hostname.replace(/^www\./,'')===location.hostname.replace(/^www\./,'')&&!/(^|\/)(checkout|cart|account|my-account|wp-admin|admin|user|login|search)(\/|$)/i.test(decodeURIComponent(u.pathname))?u.pathname:null;}catch{return null;}};
 let active=false,sessionId=null,viewId=null,queue=[],timer=null,sending=false,observer=null;
 let milestones=new Set(),seenRegions=new Set(),lastClick=null,recentClicks=new Map();
 const storageKey=`dunnio:${cfg.siteKey}`;
 function storageGet(k){try{return sessionStorage.getItem(k);}catch{return null;}}
 function storageSet(k,v){try{sessionStorage.setItem(k,v);}catch{/* Memory-only mode when storage is unavailable. */}}
 function storageRemove(k){try{sessionStorage.removeItem(k);}catch{}}
 function dimensions(){const w=innerWidth;return {device:w<768?'mobile':w<1024?'tablet':'desktop',layoutVersion:cfg.layoutVersion,viewportWidth:w,viewportHeight:innerHeight,documentHeight:Math.max(innerHeight,document.documentElement.scrollHeight)};}
 function event(type,data={},context={}){return {id:uuid(),viewId,type,timestamp:Date.now(),pagePath:path,...dimensions(),...context,...data};}
 function enqueue(e){if(!active||optedOut())return;queue.push(e);if(queue.length>100)queue.shift();if(queue.length>=20)void flush();}
 function payload(events){return {siteKey:cfg.siteKey,sessionId,consent:true,events};}
 async function flush(unload=false){
  if(!active||optedOut()||!queue.length||sending)return;
  const batch=queue.slice(0,30),body=JSON.stringify(payload(batch));
  if(unload&&navigator.sendBeacon){
   if(navigator.sendBeacon(`${cfg.apiEndpoint}/tracker/events`,new Blob([body],{type:'application/json'}))){queue.splice(0,batch.length);return;}
  }
  sending=true;
  try{const r=await fetch(`${cfg.apiEndpoint}/tracker/events`,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,credentials:'omit'});
   if(r.ok)queue=queue.filter(e=>!batch.some(b=>b.id===e.id));
   else if(r.status>=400&&r.status<500&&r.status!==429)queue=queue.filter(e=>!batch.some(b=>b.id===e.id));
  }catch{/* Retain the same IDs for retry; never send twice with a new identity. */}finally{sending=false;}
 }
 function click(e){
  if(!active||!(e.target instanceof Element)||e.target.closest(excluded)||!e.isTrusted)return;
  const el=e.target.closest('[data-track-key],a,button,[role="button"],summary')||e.target;
  const region=el.closest('[data-track-region]')?.getAttribute('data-track-region')||'unmarked';
  const elementKey=el.getAttribute('data-track-key');const targetPath=el.tagName==='A'?safePath(el.getAttribute('href')):null;
  // Actual pointer position in document coordinates, including scrolled content.
  if(e.detail===0)return; // Keyboard activation has no spatial pointer coordinate.
  const x=e.clientX+scrollX,y=e.clientY+scrollY,d=dimensions();
  if(x<0||x>=d.viewportWidth||y<0||y>=d.documentHeight)return;
  const c=event('click',{x,y,region:key.test(region)?region:'unmarked',elementKey:key.test(elementKey||'')?elementKey:null,targetPath});
  enqueue(c);lastClick=c;recentClicks.set(c.id,c);if(recentClicks.size>100)recentClicks.delete(recentClicks.keys().next().value);
  if(targetPath&&cfg.goalPaths.includes(targetPath)&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&el.target!=='_blank') {
   storageSet(`${storageKey}:pending`,JSON.stringify({source:c,targetPath,expires:Date.now()+1800000}));void flush();
  }
 }
 function scroll(){
  if(!active)return;const height=document.documentElement.scrollHeight;
  const depth=Math.min(100,Math.round((scrollY+innerHeight)/Math.max(height,innerHeight)*100));
  for(const milestone of [25,50,75,100])if(depth>=milestone&&!milestones.has(milestone)){milestones.add(milestone);enqueue(event('scroll',{scrollDepth:milestone}));}
 }
 function observe(){
  if(!('IntersectionObserver' in window))return;
  observer=new IntersectionObserver(entries=>{
   for(const en of entries)if(en.isIntersecting){const region=en.target.getAttribute('data-track-region');if(!key.test(region||'')||seenRegions.has(region))continue;
    const rect=en.target.getBoundingClientRect(),d=dimensions();const x=Math.min(d.viewportWidth-1,Math.max(0,rect.left+rect.width/2));const y=Math.min(d.documentHeight-1,Math.max(0,rect.top+scrollY));
    seenRegions.add(region);enqueue(event('exposure',{region,x,y}));
   }
  },{threshold:0});
  document.querySelectorAll('[data-track-region]').forEach(el=>{if(!el.closest('[data-track-private]'))observer.observe(el);});
 }
 function start(){
  if(active||!cfg.enabled||!allowed||optedOut()||!cfg.apiEndpoint||!key.test(cfg.siteKey)||!key.test(cfg.layoutVersion)||Math.random()>Math.max(0,Math.min(1,cfg.sampleRate)))return;
  active=true;sessionId=storageGet(`${storageKey}:session`)||uuid();storageSet(`${storageKey}:session`,sessionId);viewId=uuid();
  enqueue(event('pageview'));
  try{const pending=JSON.parse(storageGet(`${storageKey}:pending`)||'null');
   if(pending&&pending.expires>Date.now()&&pending.targetPath===path&&cfg.goalPaths.includes(path)) {
    const s=pending.source;enqueue(event('action',{actionName:'navigation',sourceEventId:s.id,targetPath:path},{...s,id:uuid(),type:'action',timestamp:Date.now()}));
   }
  }catch{/* Ignore stale or malformed attribution. */}
  storageRemove(`${storageKey}:pending`);observe();scroll();timer=setInterval(()=>void flush(),10000);
 }
 function consent(value){
  cfg.consent=value===true;
  if(cfg.consent)start();else{active=false;queue=[];clearInterval(timer);observer?.disconnect();storageRemove(`${storageKey}:pending`);storageRemove(`${storageKey}:session`);sessionId=null;lastClick=null;recentClicks.clear();milestones.clear();seenRegions.clear();}
 }
 function trackAction(name,sourceId=lastClick?.id){
  const source=recentClicks.get(sourceId);
  if(!active||!source||Date.now()-source.timestamp>1800000||!['form_success','customizer_start'].includes(name))return false;
  // Call only after the site's form/customizer callback confirms success.
  enqueue(event('action',{actionName:name,sourceEventId:sourceId},{...source,id:uuid(),type:'action',timestamp:Date.now()}));void flush();return true;
 }
 document.addEventListener('click',click,true);
 let scheduled=false;window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scroll();scheduled=false;});}},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush(true);});
 window.addEventListener('pagehide',()=>void flush(true));
 // A width change starts a new view segment so report denominators match its viewport.
 let width=innerWidth,resizeTimer;
 window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(active&&width!==innerWidth){width=innerWidth;viewId=uuid();milestones=new Set();seenRegions=new Set();observer?.disconnect();enqueue(event('pageview'));observe();scroll();}},300);});
 window.dunnioTracker={setConsent:consent,flush,trackAction,getLastClickId:()=>lastClick?.id||null,getState:()=>({active,queued:queue.length,consent:cfg.consent})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(cfg.consent)start();},{once:true});else if(cfg.consent)start();
})();
