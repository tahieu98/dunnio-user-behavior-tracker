'use strict';
const $=id=>document.getElementById(id);
const demo=new URLSearchParams(location.search).get('demo')==='1';
const token=localStorage.getItem('auth_token')||sessionStorage.getItem('auth_token');
let catalog=null,report=null,loaded=null,selected=null,metric='clicks',requestId=0,currentUser=null;
let catalogOffset=0,archiveReport=null;
const typeLabels={'home':'Trang chủ','blog-category':'Danh mục blog','blog-article':'Bài blog','product-category':'Danh mục sản phẩm','product':'Sản phẩm','service':'Dịch vụ / thiết kế','other':'Trang khác'};
function filteredPages(){return catalog.pages.filter(p=>p.site_id===Number($('site').value)||!p.site_id).filter(p=>$('pageType').value==='all'||(p.content_type||'blog-article')===$('pageType').value).filter(p=>`${p.title} ${p.url_path}`.toLowerCase().includes($('pageSearch').value.toLowerCase().trim()));}
const apiDeviceOf=v=>/pc|desktop/i.test(v||'')?'desktop':/mobile/i.test(v||'')?'mobile':/tablet/i.test(v||'')?'tablet':'all';
const metricValue=(p,group,key)=>p.clarity?.metrics?.[group]?.filter(v=>!v.Device||apiDeviceOf(v.Device)===$('device').value).map(v=>v[key]).filter(v=>v!==null&&v!==undefined)||[];
function catalogTable(){
 const pages=filteredPages().sort((a,b)=>Math.max(0,...metricValue(b,'Traffic','totalSessionCount').map(Number))-Math.max(0,...metricValue(a,'Traffic','totalSessionCount').map(Number))||a.title.localeCompare(b.title));
 catalogOffset=Math.min(catalogOffset,Math.max(0,Math.ceil(pages.length/20)-1)*20);
 $('pageCount').textContent=`${pages.length} trang trong bộ lọc / ${catalog.pages.filter(p=>!p.site_id||p.site_id===Number($('site').value)).length} trang đã biết. Trang đích chuyển đổi được đánh dấu riêng. URL không xuất hiện trong API vẫn có thể được chọn.`;
 $('pageRows').replaceChildren(...pages.slice(catalogOffset,catalogOffset+20).map(p=>{
  const tr=el('tr'),name=el('td',p.title);name.append(el('small',p.url_path));if(p.is_goal)name.append(el('small','Trang đích chuyển đổi','goal-label'));
  const values=metricValue(p,'Traffic','totalSessionCount'),scroll=metricValue(p,'ScrollDepth','averageScrollDepth');
  const sessions=el('td',values.length?values.map(num).join(' / '):'—');sessions.title=p.clarity?.urlVariants?.join('\n')||'URL chưa có trong bản export này';
  const actions=el('td'),button=el('button','Phân tích','button');button.addEventListener('click',()=>{$('page').value=p.url_path;fillLayouts();void loadReport();$('heatmapPanels').scrollIntoView({behavior:'smooth'});});actions.append(button);
  tr.append(name,el('td',typeLabels[p.content_type||'blog-article']),sessions,el('td',scroll.length?scroll.map(v=>`${num(v)}%`).join(' / '):'—'),actions);return tr;
 }));
 if(!pages.length){const tr=el('tr'),td=el('td','Không tìm thấy trang phù hợp.');td.colSpan=5;tr.append(td);$('pageRows').append(tr);}
 $('pagePagination').textContent=pages.length?`${catalogOffset+1}–${Math.min(pages.length,catalogOffset+20)} / ${pages.length}`:'0 trang';$('previousPages').disabled=catalogOffset===0;$('nextPages').disabled=catalogOffset+20>=pages.length;
 const c=catalog.clarity,date=v=>new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
 $('clarityWindow').textContent=c?`Clarity Export · ${c.numOfDays*24} giờ: ${date(c.windowStart)} – ${date(c.fetchedAt)}. ${c.dimensions?.includes('Device')?`Thiết bị: ${$('device').value}.`:'Bản này gộp mọi thiết bị.'} Cột này là số phiên, không phải tổng lượt chạm; nhiều biến thể URL được hiển thị riêng bằng dấu /. Không áp dụng bộ lọc tháng cho bảng API. ${c.possibleTruncation?'API có thể đã chạm giới hạn 1.000 dòng; không đảm bảo đầy đủ URL lưu lượng.':''}`:'Chưa có bản export Clarity. Đồng bộ để đọc số liệu thật theo URL.';
}
const num=v=>v===null||v===undefined?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(v);
const signed=v=>v===null?'—':`${v>0?'+':''}${num(v)}`;
const formatMetric=v=>v===null||v===undefined?'—':Array.isArray(v)?v.map(formatMetric).join(' / '):typeof v==='number'||typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?num(Number(v)):typeof v==='object'?JSON.stringify(v):String(v);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function msg(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
function option(value,label){const e=el('option',label);e.value=value;return e;}
async function api(path,options={}){
 const r=await fetch(`/api/${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});
 let body;try{body=await r.json();}catch{throw new Error('Máy chủ trả về dữ liệu không hợp lệ');}
 if(r.status===401&&!demo){localStorage.removeItem('auth_token');sessionStorage.removeItem('auth_token');location.href='login.html';throw new Error('Phiên đăng nhập đã hết hạn');}
 if(!r.ok||!body.success)throw new Error(body.message||body.errors?.[0]?.msg||'Không thể thực hiện yêu cầu');
 return body.data;
}
function chosen(){
 const layout=$('layout').value.split('|'),layoutB=$('layoutB').value.split('|');
 return {siteId:Number($('site').value),path:$('page').value,device:$('device').value,version:layout[0]||'',width:Number(layout[1]||0),versionB:layoutB[0]||layout[0]||'',widthB:Number(layoutB[1]||layout[1]||0),startA:$('startA').value,endA:$('endA').value,startB:$('startB').value,endB:$('endB').value};
}
function fillPages(){
 const old=$('page').value,site=catalog.sites.find(s=>s.id===Number($('site').value));
 const pages=filteredPages();
 $('page').replaceChildren(...pages.map(p=>option(p.url_path,p.title)));
 if(pages.some(p=>p.url_path===old))$('page').value=old;else if(pages.some(p=>p.url_path.includes('what-suit-color'))) $('page').value='/blog/what-suit-color-to-choose.html';
 $('siteLabel').textContent=site?.name||'Chưa có website';catalogTable();fillLayouts();
}
function fillLayouts(){
 const o=chosen(),old=$('layout').value,oldB=$('layoutB').value;
 const records=[...catalog.layouts,...catalog.snapshots].filter(s=>s.site_id===o.siteId&&s.page_path===o.path&&s.device===o.device);
 const unique=[...new Map(records.map(r=>[`${r.layout_version}|${r.viewport_width}`,r])).values()];
 $('layout').replaceChildren(...unique.map(r=>option(`${r.layout_version}|${r.viewport_width}`,`${r.layout_version} · ${r.viewport_width}px`)));
 $('layoutB').replaceChildren(...unique.map(r=>option(`${r.layout_version}|${r.viewport_width}`,`${r.layout_version} · ${r.viewport_width}px`)));
 if(unique.some(r=>`${r.layout_version}|${r.viewport_width}`===old))$('layout').value=old;
 if(unique.some(r=>`${r.layout_version}|${r.viewport_width}`===oldB))$('layoutB').value=oldB;else $('layoutB').value=$('layout').value;
 if(!unique.length){const width=o.device==='mobile'?390:o.device==='tablet'?820:1440;$('layout').append(option(`release-1|${width}`,'release-1 · chưa nhận sự kiện / ảnh'));$('layoutB').append(option(`release-1|${width}`,'release-1 · chưa nhận sự kiện / ảnh'));}
 const page=catalog.pages.find(p=>p.url_path===$('page').value&&(!p.site_id||p.site_id===o.siteId));$('selectedPagePath').textContent=page?.url_path||'Chưa chọn trang';$('selectedPageLink').href=page?.url||catalog.sites.find(s=>s.id===o.siteId)?.origin||'#';
 invalidate();installCode();catalogTable();renderApiFields();
}
function invalidate(){
 requestId++;report=null;archiveReport=null;loaded=null;selected=null;$('export').disabled=true;$('saveNote').disabled=true;$('dataNotice').hidden=true;
 $('mapA').replaceChildren();$('mapB').replaceChildren();$('regionRows').replaceChildren(el('tr'));
 $('regionRows').firstChild.append(el('td','Bộ lọc đã thay đổi. Bấm So sánh để tải báo cáo mới.'));
 $('regionRows').firstChild.firstChild.colSpan=4;
 $('metrics').querySelectorAll('strong').forEach(e=>e.textContent='—');
 $('metrics').querySelectorAll('small').forEach(e=>e.remove());
 $('hotspots').replaceChildren();$('cellTitle').textContent='Khám phá một điểm chạm';$('cellBody').replaceChildren(el('p','Chọn ô trên heatmap sau khi tải báo cáo.'));
 $('mapStatsA').textContent='—';$('mapStatsB').textContent='—';$('coverageA').textContent='Chưa tải dữ liệu';$('coverageB').textContent='Chưa tải dữ liệu';$('notes').replaceChildren();$('scrollSummary').replaceChildren();
}
function installCode(){
 if(!catalog)return;const o=chosen(),site=catalog.sites.find(s=>s.id===o.siteId);if(!site)return;
 const goals=typeof site.goal_paths==='string'?JSON.parse(site.goal_paths):site.goal_paths;
 const config={apiEndpoint:`${location.origin}/api`,siteKey:site.public_key,layoutVersion:o.version||'release-1',consent:false,sampleRate:1,scope:site.tracking_scope||'all-public',allowedPaths:site.tracking_scope==='registered'?catalog.pages.filter(p=>p.site_id===site.id).map(p=>p.url_path):[],goalPaths:goals};
 $('installCode').textContent=`<script>\nwindow.TRACKER_CONFIG = ${JSON.stringify(config,null,2)};\n<\/script>\n<script defer src="${location.origin}/tracker/behavior-tracker.js"><\/script>\n\n// Callback consent từ CMP:\nwindow.dunnioTracker?.setConsent(true);\n// Sau khi form đã báo thành công:\n// window.dunnioTracker?.trackAction('form_success', clickId);`;
}
function renderMetrics(){
 const {a,b}=report,stats=[['Lượt xem trang','pageviews'],['Lượt chạm','clicks'],['Hành động được xác nhận','actions'],['Tỷ lệ chạm → hành động','actionRate']];
 $('metrics').replaceChildren(...stats.map(([title,key])=>{
  const missing=!demo&&a.hasData===false,c=el('div',undefined,'card stat');c.append(el('span',title),el('strong',missing?'—':`${num(a.summary[key])}${key==='actionRate'&&a.summary[key]!==null?'%':''}`));
  const line=el('small');const delta=a.summary[key]===null||b.summary[key]===null?null:a.summary[key]-b.summary[key];
  line.append(el('span',missing?'Chưa nhận sự kiện':`${signed(delta)}${key==='actionRate'?' điểm %':''}`,`change ${delta<0?'down':''}`),document.createTextNode(b.hasData===false?' · B chưa có dữ liệu':` so với ${num(b.summary[key])}${key==='actionRate'&&b.summary[key]!==null?'%':''} ở B`));c.append(line);return c;
 }));
}
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs={}){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;}
function cellValue(c,r){
 const n=metric==='actions'?c.actions:c.clicks;
 return $('normalization').value==='rate'?(r.summary.pageviews?n/r.summary.pageviews*100:0):n;
}
function sharedMax(){
 if(metric==='delta')return Math.max(1,...report.deltas.map(d=>Math.abs($('normalization').value==='rate'?(d.rateDelta||0):d.delta)));
 return Math.max(1,...[report.a,report.b].flatMap(r=>r.cells.map(c=>cellValue(c,r))));
}
function pointDensity(r){
 const radius=36,points=r.points||[],buckets=new Map(),key=(x,y)=>`${x}:${y}`;
 for(const p of points){const k=key(Math.floor(p.x/radius),Math.floor(p.y/radius));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);}
 return points.map(p=>{let count=0;const bx=Math.floor(p.x/radius),by=Math.floor(p.y/radius);
  for(let x=bx-1;x<=bx+1;x++)for(let y=by-1;y<=by+1;y++)for(const q of buckets.get(key(x,y))||[])if((q.x-p.x)**2+(q.y-p.y)**2<=radius**2)count+=metric==='actions'?q.actions:q.clicks;
  return {...p,nearbyCount:count,value:$('normalization').value==='rate'?(r.summary.pageviews?count/r.summary.pageviews*100:0):count};
 });
}

/**
 * Rank measured points by click/action count and compute percentage share.
 * Returns top-N points with rank, count, and percent of total.
 */
function rankPoints(period) {
 const points = report.pointDensity[period]
  .filter(p => metric === 'actions' ? p.actions : p.clicks)
  .sort((a, b) => (metric === 'actions' ? b.actions : b.clicks) - (a.actions || a.clicks));
 const total = points.reduce((s, p) => s + (metric === 'actions' ? p.actions : p.clicks), 0);
 return points.map((p, i) => ({
  ...p,
  rank: i + 1,
  percent: total ? Math.round((metric === 'actions' ? p.actions : p.clicks) / total * 1000) / 10 : 0
 }));
}
function drawMap(id,r,period){
 const version=period==='a'?loaded.version:loaded.versionB,width=(period==='a'?loaded.width:loaded.widthB)||1440;
 const container=$(id),snap=report.snapshots?.[period]||catalog.layouts.find(s=>s.site_id===loaded.siteId&&s.page_path===loaded.path&&s.device===loaded.device&&s.layout_version===version&&s.viewport_width===width);
 const height=Math.max(100,Number(snap?.document_height)||r.geometry?.maxHeight||1000),max=sharedMax();
 container.replaceChildren();container.style.aspectRatio=`${width} / ${height}`;container.style.minHeight='0';container.style.width=`${Number($('zoom').value)*100}%`;
 if(snap?.image_path&&/^\/snapshots\/[a-zA-Z0-9_.-]+\.png$/.test(snap.image_path)){
  const img=el('img');img.src=snap.image_path;img.alt=`Ảnh tham chiếu trang tại phiên bản ${version}`;img.width=width;img.height=height;
  img.addEventListener('error',()=>{img.remove();container.append(el('div','Không thể tải ảnh tham chiếu. Tọa độ lưới vẫn dùng dữ liệu sự kiện.','no-snapshot'));},{once:true});container.append(img);
 }else container.append(el('div',archiveReport?`Chưa nhập PNG Clarity cho tháng ${r.month}.`:'Chưa có ảnh chụp đúng phiên bản và chiều rộng. Đây là lưới tọa độ, chưa phủ lên ảnh trang.','no-snapshot'));
 const svg=svgEl('svg',{viewBox:`0 0 ${width} ${height}`,tabindex:'0',role:'application','aria-label':`Heatmap tháng ${r.month}. Dùng phím mũi tên di chuyển ô và Enter để chọn.`});
 const defs=svgEl('defs'),pattern=svgEl('pattern',{id:`grid-${period}`,width:width/12,height:50,patternUnits:'userSpaceOnUse'});
 pattern.append(svgEl('path',{d:`M ${width/12} 0 L 0 0 0 50`,fill:'none',stroke:'#214e8a','stroke-width':1}));defs.append(pattern);svg.append(defs);
 svg.append(svgEl('rect',{width,height,fill:`url(#grid-${period})`,class:'grid-lines'}));
 const data=metric==='delta'?report.deltas.map(d=>({...d,value:$('normalization').value==='rate'?(d.rateDelta||0):d.delta})):r.cells.map(c=>({...c,value:cellValue(c,r)}));
 for(const c of data){
  if(Array.isArray(r.points)&&metric!=='delta')continue;
  if(!c.value)continue;const t=Math.abs(c.value)/max;
  const color=metric==='delta'?(c.value>0?'#ed5b3e':'#397cd9'):(t>.65?'#ed5b3e':t>.3?'#eebf48':'#397cd9');
  const rect=svgEl('rect',{x:(c.col-1)*width/12,y:(c.row-1)*50,width:width/12,height:50,fill:color,'fill-opacity':.2+t*.45,stroke:color,'stroke-opacity':.65});
  rect.append(svgEl('title'));rect.lastChild.textContent=`Ô C${c.col} · R${c.row}: ${num(c.value)} ${$('normalization').value==='rate'?'trên 100 lượt xem':'lượt'}`;svg.append(rect);
  // A soft halo emphasizes hotspots without changing their measured cell location.
  const gradient=svgEl('radialGradient',{id:`hot-${period}-${c.col}-${c.row}`});gradient.append(svgEl('stop',{offset:'0%','stop-color':color,'stop-opacity':'.65'}),svgEl('stop',{offset:'100%','stop-color':color,'stop-opacity':'0'}));defs.append(gradient);
  svg.append(svgEl('ellipse',{cx:(c.col-.5)*width/12,cy:(c.row-.5)*50,rx:width/16,ry:55,fill:`url(#hot-${period}-${c.col}-${c.row})`,'pointer-events':'none'}));
 }
 if(Array.isArray(r.points)&&metric!=='delta'){
  // Top-10 ranked bubbles, same style as Clarity click map.
  const ranked=rankPoints(period).slice(0,10);
  if(ranked.length){
   const maxPoint=Math.max(.000001,...ranked.map(p=>p.value));
   for(const p of ranked){
    const count=metric==='actions'?p.actions:p.clicks;
    const t=p.value/maxPoint;
    const heatColor=t>.65?'#ed5b3e':t>.3?'#eebf48':'#397cd9';
    const gid=`ranked-${period}-${p.rank}`;
    const gradient=svgEl('radialGradient',{id:gid});
    gradient.append(svgEl('stop',{offset:'0%','stop-color':heatColor,'stop-opacity':'.7'}),svgEl('stop',{offset:'100%','stop-color':heatColor,'stop-opacity':'0'}));
    defs.append(gradient);
    // Outer halo
    svg.append(svgEl('circle',{cx:p.x,cy:p.y,r:Math.min(34,width/20),fill:`url(#${gid})`}));
    // Rank badge: white circle + colored number
    const badge=svgEl('g',{class:'rank-badge','data-rank':p.rank,'data-period':period});
    badge.append(svgEl('circle',{cx:p.x,cy:p.y,r:16,fill:'#fff',stroke:heatColor,'stroke-width':2.5}));
    const label=svgEl('text',{x:p.x,y:p.y+5,'text-anchor':'middle',fill:heatColor,'font-size':13,'font-weight':700,'font-family':'inherit'});
    label.textContent=p.rank;
    badge.append(label);
    const title=svgEl('title');
    title.textContent=`Hạng ${p.rank} · ${num(count)} ${metric==='actions'?'hành động':'chạm'} · ${p.percent}% tổng · X ${Math.round(p.x)} · Y ${Math.round(p.y)} · vùng lân cận ${p.nearbyCount} trong 36px`;
    badge.append(title);
    badge.addEventListener('click',e=>{e.stopPropagation();inspectByPoint(p,period);});
    svg.append(badge);
   }
   // Note if points were truncated
   if(report.a.pointsTruncated||report.b.pointsTruncated){
    const note=svgEl('text',{x:width-8,y:height-8,'text-anchor':'end','font-size':9,fill:'#616b7b'});
    note.textContent='⚠ top-10 / 5000 pts';
    svg.append(note);
   }
  }
 }
 if(!$('gridToggle').checked)svg.classList.add('grid-off');
 const focus=svgEl('rect',{class:'cell-focus',width:width/12,height:50,visibility:'hidden','pointer-events':'none'});svg.append(focus);
 let cursor={col:selected?.col||1,row:selected?.row||1};
 function move(){focus.setAttribute('x',(cursor.col-1)*width/12);focus.setAttribute('y',(cursor.row-1)*50);focus.setAttribute('visibility','visible');}
 svg.addEventListener('click',e=>{const b=svg.getBoundingClientRect();cursor={col:Math.min(12,Math.floor((e.clientX-b.left)/b.width*12)+1),row:Math.min(Math.ceil(height/50),Math.floor((e.clientY-b.top)/b.height*height/50)+1)};move();inspect(cursor.col,cursor.row,period);});
 svg.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key))return;e.preventDefault();
  if(e.key==='ArrowLeft')cursor.col=Math.max(1,cursor.col-1);if(e.key==='ArrowRight')cursor.col=Math.min(12,cursor.col+1);if(e.key==='ArrowUp')cursor.row=Math.max(1,cursor.row-1);if(e.key==='ArrowDown')cursor.row=Math.min(Math.ceil(height/50),cursor.row+1);
  move();inspect(cursor.col,cursor.row,period);
 });
 if(selected)move();container.append(svg);
}
function render(){
 report.pointDensity={a:pointDensity(report.a),b:pointDensity(report.b)};
 $('scaleCaption').textContent='12 cột · hàng 50 px · cùng thang màu';
 document.querySelector('[data-metric=actions]').disabled=!!archiveReport;
 $('normalization').disabled=!!archiveReport;
 renderMetrics();
 // dayBounds dùng end EXCLUSIVE (00:00 ngày sau, Asia/Ho_Chi_Minh). Hiển thị phải trừ 1 ngày để khớp lựa chọn của user.
 const fmtD=s=>s?new Date(s.includes('T')?s:s.replace(' ','T')+'Z').toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
 const fmtRange=(start,end)=>{if(!start||!end)return '—';const endInclusive=new Date(new Date(end.includes('T')?end:end.replace(' ','T')+'Z').getTime()-86400000).toISOString();return `${fmtD(start)} – ${fmtD(endInclusive)}`;};
 $('periodA').textContent=report.a.start?fmtRange(report.a.start,report.a.end):report.a.month||'—';
 $('periodB').textContent=report.b.start?fmtRange(report.b.start,report.b.end):report.b.month||'—';
 const deltaButton=document.querySelector('[data-metric=delta]');deltaButton.disabled=report.comparableGeometry===false;
 if(deltaButton.disabled&&metric==='delta'){metric='clicks';document.querySelectorAll('[data-metric]').forEach(x=>x.classList.toggle('selected',x.dataset.metric==='clicks'));}
 for(const [p,r] of [['A',report.a],['B',report.b]]){
  $(`mapStats${p}`).textContent=!demo&&r.hasData===false?'Chưa nhận sự kiện cho bộ lọc này':`${num(r.summary.pageviews)} xem · ${num(r.summary.clicks)} chạm · ${num(r.summary.actions)} hành động`;
  const date=s=>s?new Date(s.includes('T')?s:s.replace(' ','T')+'Z').toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
  $(`coverage${p}`).textContent=r.summary.pageviews?`${p==='A'?loaded.version:loaded.versionB} · ${p==='A'?loaded.width:loaded.widthB}px · nhận ${date(r.coverage.first)}–${date(r.coverage.last)}`:'Không có dữ liệu phù hợp trong tháng này';
 }
 const warnings=[];
 if(report.a.lowSample||report.b.lowSample)warnings.push('Mẫu nhỏ (<100 lượt xem): chưa đủ cơ sở kết luận hiệu quả nội dung.');
 if(!demo)warnings.push('Phạm vi dữ liệu được tính từ sự kiện đã nhận; không tự khôi phục lịch sử trước khi cài tracker.');
 if(report.snapshot)warnings.push(`Ảnh tham chiếu: ${String(report.snapshot.captured_at||'').slice(0,10)}.`);
 if(report.geometryWarning)warnings.push(report.geometryWarning);
 if(report.a.pointsTruncated||report.b.pointsTruncated)warnings.push('Hiển thị tối đa 5.000 vị trí mỗi tháng; bảng ô và tổng lượt vẫn tính toàn bộ sự kiện.');
 if(report.comparableGeometry===false)warnings.push('Hai phiên bản hoặc chiều rộng khác nhau: đối chiếu theo tên vùng. Chênh lệch từng ô bị tắt vì cùng tọa độ có thể là nội dung khác.');
 $('sampleWarning').textContent=warnings.join(' ');
 $('legend').classList.toggle('delta-legend',metric==='delta');
 $('legend').replaceChildren(el('span',metric==='delta'?'Giảm ở A':'Ít'),el('span',undefined,'gradient'),el('span',metric==='delta'?'Tăng ở A':'Nhiều'));
 drawMap('mapA',report.a,'a');drawMap('mapB',report.b,'b');renderRegions();renderHotspots();
 if(!demo&&(report.a.hasData===false||report.b.hasData===false)){$('dataNotice').hidden=false;$('dataNotice').textContent='Kho tracker riêng chưa nhận đủ dữ liệu cho tháng / phiên bản đang chọn. Số liệu Clarity thật nằm ở bảng URL phía trên. Để xem heatmap lịch sử Clarity, chọn nguồn PNG/CSV đã xuất; API tổng hợp không trả điểm chạm theo tháng.';}
 else $('dataNotice').hidden=true;
 $('export').disabled=false;if(selected)inspect(selected.col,selected.row);
}
function renderRegions(){
 const am=new Map(report.a.regions.map(r=>[r.key,r])),bm=new Map(report.b.regions.map(r=>[r.key,r]));
 const keys=[...new Set([...am.keys(),...bm.keys()])].sort((x,y)=>(am.get(y)?.clicks||0)-(am.get(x)?.clicks||0));
 $('regionRows').replaceChildren(...keys.map(key=>{const a=am.get(key),b=bm.get(key),tr=el('tr');const delta=report.a.summary.pageviews&&report.b.summary.pageviews?(a?.per100Views||0)-(b?.per100Views||0):null;
  const adjustedDelta=archiveReport&&(!a||!b)?null:delta;
  const title=el('td',key);if(!archiveReport)title.append(el('small',`Đã thấy: ${num(a?.exposures||0)} / ${num(b?.exposures||0)} view`));
  tr.append(title,el('td',archiveReport?`${num(a?.clicks)} / ${num(b?.clicks)}`:`${num(a?.clicks||0)} / ${num(b?.clicks||0)}`),el('td',signed(adjustedDelta),adjustedDelta>0?'positive':adjustedDelta<0?'negative':''),el('td',archiveReport?'—':`${num(a?.actions||0)} / ${num(b?.actions||0)}`));return tr;
 }));
 if(!keys.length){const tr=el('tr'),td=el('td','Chưa có tương tác cho bộ lọc này. Kiểm tra cài đặt tracker và consent.');td.colSpan=4;tr.append(td);$('regionRows').append(tr);}
 const scroll=report.a.scroll.map(s=>`${s.depth}%: ${num(s.views)} lượt xem`).join(' · ');
 $('scrollSummary').textContent=`Độ sâu trang đã nhìn thấy ở A: ${scroll||'chưa có dữ liệu'}. Mỗi view chỉ đếm một lần tại mỗi mốc.`;
}
function renderHotspots(){
 $('hotspots').replaceChildren(...[...report.a.cells].sort((a,b)=>b.clicks-a.clicks).slice(0,6).map(c=>{const button=el('button',`C${c.col} · R${c.row} — ${c.clicks} chạm`);button.addEventListener('click',()=>{inspect(c.col,c.row,'a');const box=$('mapA'),height=Number(report.snapshots?.a?.document_height)||7000;$('scrollA').scrollTop=(c.row-1)*50/height*box.offsetHeight;if(report.comparableGeometry)$('scrollB').scrollTop=$('scrollA').scrollTop;});return button;}));
}
function inspectByPoint(point,period){
 selected={...point,period,isPoint:true};
 const rankA=rankPoints('a').find(p=>p.x===point.x&&p.y===point.y),rankB=rankPoints('b').find(p=>p.x===point.x&&p.y===point.y);
 const countA=rankA? (metric==='actions'?rankA.actions:rankA.clicks) : null, countB=rankB? (metric==='actions'?rankB.actions:rankB.clicks) : null;
 $('cellTitle').textContent=`Điểm hạng ${point.rank} · ${period.toUpperCase()} · X ${Math.round(point.x)} Y ${Math.round(point.y)}`;
 const body=$('cellBody');body.replaceChildren();
 body.append(el('p',`X: ${Math.round(point.x)} px · Y: ${Math.round(point.y)} px · vùng lân cận ${point.nearbyCount} trong 36px`));
 if(archiveReport){body.append(el('p','Đây là điểm trên ảnh PNG Clarity đã xuất. Chỉ đọc selector, không có tọa độ đo thật.'));$('saveNote').disabled=true;return;}
 const numbers=el('div',undefined,'cell-numbers');
 for(const [title,value] of [['Hạng A / B',`${rankA?`#${rankA.rank} · ${num(countA)}`:'—'} / ${rankB?`#${rankB.rank} · ${num(countB)}`:'—'}`],['% tổng A / B',`${rankA?rankA.percent+'%':'—'} / ${rankB?rankB.percent+'%':'—'}`],['Lân cận 36px A / B',`${rankA?rankA.nearbyCount:'—'} / ${rankB?rankB.nearbyCount:'—'}`]]) {const item=el('div',title);item.append(el('strong',value));numbers.append(item);}
 body.append(numbers);
 const col=point.col,row=point.row;
 const a=report.a.cells.find(c=>c.col===col&&c.row===row),b=report.b.cells.find(c=>c.col===col&&c.row===row);
 if(a||b) body.append(el('p',`Ô lưới C${col} · R${row} — chạm ${a?.clicks||0}/${b?.clicks||0} · hành động ${a?.actions||0}/${b?.actions||0}`));
 body.append(el('p',`Vùng: ${[...new Set([...(a?.regions||[]),...(b?.regions||[])])].join(', ')||'chưa gắn tên'}`));
 $('saveNote').disabled=demo;if(demo)body.append(el('p','Chế độ minh họa chỉ đọc.'));
 for(const id of ['mapA','mapB']){const f=$(id).querySelector('.cell-focus');const w=id==='mapA'?loaded.width:loaded.widthB;if(f){f.setAttribute('x',(col-1)*width/12);f.setAttribute('y',(row-1)*50);f.setAttribute('visibility','visible');}}
 selected={col,row,period,pointRank:point.rank,isPoint:true};
}
function inspect(col,row,period=selected?.period||'a'){
 selected={col,row,period};const a=report.a.cells.find(c=>c.col===col&&c.row===row),b=report.b.cells.find(c=>c.col===col&&c.row===row),d=report.deltas.find(c=>c.col===col&&c.row===row);
 $('cellTitle').textContent=`Ô C${col} · R${row} · ${period.toUpperCase()}`;
 const body=$('cellBody');body.replaceChildren();
 const width=period==='a'?loaded.width:loaded.widthB;
 body.append(el('p',`X: ${num((col-1)*width/12)}–${num(col*width/12)} px · Y: ${(row-1)*50}–${row*50} px`));
 if(archiveReport){body.append(el('p','Đây là ô trên ảnh PNG Clarity đã xuất. File không có số lượt chạm theo ô; đọc số lượt theo selector trong bảng. Không suy ra số lượt từ màu ảnh.'));$('saveNote').disabled=demo||!currentUser;return;}
 if(report.comparableGeometry===false)body.append(el('p','Cùng tọa độ A/B có thể chứa nội dung khác nhau. Dùng tên vùng trong bảng để so sánh nội dung qua phiên bản.'));
 const numbers=el('div',undefined,'cell-numbers');for(const [title,value] of [['Chạm A / B',`${a?.clicks||0} / ${b?.clicks||0}`],['Hành động A / B',`${a?.actions||0} / ${b?.actions||0}`]]){const item=el('div',title);item.append(el('strong',value));numbers.append(item);}body.append(numbers);
 body.append(el('p',`Δ / 100 lượt xem: ${signed(d?.rateDelta??null)} · Chạm → hành động ở A: ${num(a?.actionRate??null)}%`));
 body.append(el('p',`Vùng: ${[...new Set([...(a?.regions||[]),...(b?.regions||[])])].join(', ')||'chưa gắn tên'}`));
 body.append(el('p',`Phần tử: ${[...new Set([...(a?.elements||[]),...(b?.elements||[])])].join(', ')||'chưa gắn data-track-key'}`));
 const actionNames={navigation:'Đã mở trang mục tiêu',form_success:'Form báo thành công',customizer_start:'Trình thiết kế đã khởi chạy'};
 const actionRows=new Map();
 for(const [period,r] of [['A',report.a],['B',report.b]])for(const outcome of r.outcomes||[])if(outcome.col===col&&outcome.row===row){const key=`${outcome.name}|${outcome.targetPath||''}`;if(!actionRows.has(key))actionRows.set(key,{...outcome,A:0,B:0});actionRows.get(key)[period]+=outcome.count;}
 for(const outcome of actionRows.values())body.append(el('p',`${actionNames[outcome.name]||outcome.name}${outcome.targetPath?' → '+outcome.targetPath:''}: ${num(outcome.A)} / ${num(outcome.B)} (A / B)`));
 if(a?.clicks>=10&&a.actions===0){
  body.append(el('p','Gợi ý kiểm tra: vùng có lượt chạm nhưng chưa có hành động xác nhận. Kiểm tra callback, link đích và nhãn CTA trước khi đổi nội dung.'));
  if(!demo){const button=el('button','Dùng gợi ý này','button');button.addEventListener('click',()=>{$('noteText').value=`Kiểm tra callback, link đích và nhãn CTA ở C${col}/R${row}: ${a.clicks} lượt chạm, chưa có hành động xác nhận. Đo lại sau khi sửa.`;$('noteText').focus();});body.append(button);}
 }
 if(!a&&!b)body.append(el('p','Chưa có lượt chạm tại ô này. Không suy ra nội dung kém hiệu quả nếu chưa biết khách hàng đã nhìn thấy vùng đó.'));
 $('saveNote').disabled=demo;if(demo)body.append(el('p','Chế độ minh họa chỉ đọc. Đăng nhập để lưu đề xuất vào dữ liệu thật.'));
 for(const id of ['mapA','mapB']){const f=$(id).querySelector('.cell-focus');const w=id==='mapA'?loaded.width:loaded.widthB;if(f){f.setAttribute('x',(col-1)*w/12);f.setAttribute('y',(row-1)*50);f.setAttribute('visibility','visible');}}
}
async function loadReport(){
 if($('dataSource').value==='archive'){await loadArchiveReport();return;}
 const o=chosen();if(!o.version||!o.width||!o.versionB||!o.widthB){msg('Chưa có dữ liệu hoặc ảnh bố cục cho trang và thiết bị này. Cài tracker hoặc chụp ảnh bố cục trước.',true);return;}
 const id=++requestId;$('apply').disabled=true;msg('Đang tổng hợp hai tháng…');
 try{
  const data=await api(`${demo?'demo':'behavior'}/compare?${new URLSearchParams(o)}`);
  if(id!==requestId)return;report=data;loaded=o;selected=null;render();msg('');await loadNotes();
 }catch(e){if(id===requestId){invalidate();msg(e.message,true);}}
 finally{$('apply').disabled=false;}
}
async function loadNotes(){
 if(demo){$('notes').replaceChildren(el('p','Đề xuất trong dữ liệu thật được lưu và duyệt theo vai trò; dữ liệu minh họa chỉ đọc.'));return;}
 if(!loaded)return;const o={...loaded};
 const notes=await api(`behavior/notes?${new URLSearchParams({siteId:o.siteId,path:o.path})}`);
 if(!loaded||loaded.path!==o.path||loaded.siteId!==o.siteId)return;
 $('notes').replaceChildren(...notes.map(n=>{
  const item=el('div',undefined,'note'),text=el('div');text.append(el('small',`Ô ${(n.selected_period||'a').toUpperCase()} C${n.grid_col} · R${n.grid_row} · ${n.period_a} / ${n.period_b} · ${n.device} · ${n.layout_version} ${n.viewport_width||''}px ↔ ${n.layout_version_b||n.layout_version} ${n.viewport_width_b||''}px · ${n.username}`),el('p',n.note_text));item.append(text);
  if(currentUser?.role==='admin'){const select=el('select');select.setAttribute('aria-label',`Trạng thái đề xuất ${n.id}`);select.append(...[['pending','Chờ duyệt'],['approved','Đã duyệt'],['implemented','Đã triển khai'],['rejected','Từ chối']].map(([v,t])=>option(v,t)));select.value=n.status;select.addEventListener('change',()=>api(`behavior/notes/${n.id}`,{method:'PATCH',body:JSON.stringify({status:select.value})}).then(()=>msg('Đã cập nhật trạng thái.')).catch(e=>{select.value=n.status;msg(e.message,true);}));item.append(select);}else item.append(el('span',n.status));return item;
 }));
 if(!notes.length)$('notes').append(el('p','Chưa có đề xuất. Chọn một ô trên heatmap để bắt đầu.'));
}
function renderApiFields(){
 const page=catalog?.pages.find(p=>p.url_path===$('page').value&&(!p.site_id||p.site_id===Number($('site').value)));
 $('apiFieldsNote').textContent='Các trường API được giữ nguyên tên và giá trị. Dead/Rage/Error click là các metric riêng, không phải tổng số clicks của heatmap. Dữ liệu thiếu hiển thị —.';
 const rows=[];
 for(const [metric,values] of Object.entries(page?.clarity?.metrics||{}))for(const v of values){
  for(const [field,value] of Object.entries(v)){if(['Device','urlVariant'].includes(field))continue;const tr=el('tr');tr.append(el('td',`${metric} / ${field}`),el('td',`${v.urlVariant||page.url_path} · ${v.Device||'mọi thiết bị'}`),el('td',typeof value==='number'?num(value):value===null?'—':String(value)),el('td','—'),el('td','—'));rows.push(tr);}
 }
 $('apiMetricRows').replaceChildren(...rows);if(!rows.length){const tr=el('tr'),td=el('td','URL chưa có dữ liệu trong bản API này.');td.colSpan=5;tr.append(td);$('apiMetricRows').append(tr);}
}
async function loadExportHistory(){
 if(demo)return;const history=await api('clarity/history?limit=100'),records=history.filter(r=>r.status==='completed');
 const label=r=>`${new Date(r.requested_at.replace(' ','T')+'Z').toLocaleString('vi-VN')} · ${r.num_of_days*24}h · ${r.dimensions||'URL'}`;
 for(const id of ['exportA','exportB'])$(id).replaceChildren(...records.map(r=>option(r.id,label(r))));
 const peer=records.find((r,i)=>i>0&&r.dimensions===records[0]?.dimensions);if(peer)$('exportB').value=peer.id;
 $('compareExports').disabled=!records.length;$('exportWindowNotice').textContent='Chọn hai bản đã lưu cùng bộ dimensions. Khoảng API được tính theo thời điểm gọi; có thể chồng lấn và không phải tháng lịch.';
}
async function compareExports(){
 if(demo)return;const o=chosen();$('compareExports').disabled=true;
 try{const data=await api(`clarity/compare-exports?${new URLSearchParams({siteId:o.siteId,path:o.path,exportA:$('exportA').value,exportB:$('exportB').value,device:$('apiDevice').value})}`);
 const range=r=>`${new Date(r.start).toLocaleString('vi-VN')} – ${new Date(r.end).toLocaleString('vi-VN')} (${r.numOfDays*24}h)`;
 $('exportWindowNotice').textContent=`A: ${range(data.a)}. B: ${range(data.b)}. ${data.overlapping?'Hai khoảng đang chồng lấn. ':''}${data.warning}`;
 $('apiMetricRows').replaceChildren(...data.rows.map(r=>{const tr=el('tr');tr.append(el('td',`${r.metric} / ${r.field}`),el('td',`${r.url} · ${r.device}${r.ambiguous?' · nhiều dòng, chưa tính delta':''}`),el('td',formatMetric(r.a)),el('td',formatMetric(r.b)),el('td',signed(r.delta)));return tr;}));
 if(!data.rows.length){const tr=el('tr'),td=el('td','URL / thiết bị chưa có trong các bản này.');td.colSpan=5;tr.append(td);$('apiMetricRows').append(tr);}
 }catch(e){msg(e.message,true);}finally{$('compareExports').disabled=false;}
}
async function refreshCatalog(exportId){const old=$('site').value;catalog=await api(`behavior/catalog?${new URLSearchParams(exportId?{exportId}:{numOfDays:$('clarityDays').value})}`);$('site').replaceChildren(...catalog.sites.map(s=>option(s.id,s.name)));if(catalog.sites.some(s=>String(s.id)===old))$('site').value=old;fillPages();await loadExportHistory();}
async function syncExport(){
 if(demo){msg('Chế độ minh họa không gọi Clarity.');return;}
 for(const id of ['syncClarity','refreshClarity'])$(id).disabled=true;
 try{const result=await api('clarity/sync/all',{method:'POST',body:JSON.stringify({numOfDays:Number($('clarityDays').value),dimensions:['URL','Device']})});await refreshCatalog(result.export?.id);msg('Đã đọc bản export thật theo URL và thiết bị. API dùng cache 4 giờ, tối đa 10 yêu cầu/ngày.');await loadReport();}
 catch(e){msg(e.message,true);}finally{for(const id of ['syncClarity','refreshClarity'])$(id).disabled=false;}
}
async function loadArchiveReport(){
 const o=chosen(),id=++requestId;$('apply').disabled=true;msg('Đang đọc heatmap Clarity đã lưu…');
 try{
  const data=await api(`behavior/heatmap-archives?${new URLSearchParams(o)}`);if(id!==requestId)return;
  archiveReport=data;loaded={...o,version:data.a?`clarity-${data.a.id}`:'clarity-missing',versionB:data.b?`clarity-${data.b.id}`:'clarity-missing',width:data.a?.viewport_width||o.width,widthB:data.b?.viewport_width||o.widthB};selected=null;metric='clicks';
  const cohort=(r,month)=>({month,hasData:!!r,summary:{pageviews:r?.pageviews??null,clicks:r?.clicks??null,actions:null,actionRate:null},cells:[],points:[],regions:(r?.selector_counts||[]).map(s=>({key:s.key,clicks:s.count,actions:null,per100Views:r?.pageviews?s.count/r.pageviews*100:null,exposures:null})),scroll:[],outcomes:[],coverage:{first:r?.created_at,last:r?.created_at},lowSample:false});
  report={a:cohort(data.a,o.monthA),b:cohort(data.b,o.monthB),deltas:[],snapshots:{a:data.a,b:data.b},comparableGeometry:false,source:'clarity-file'};
  render();$('sampleWarning').textContent=data.warning;$('dataNotice').hidden=!!data.a&&!!data.b;$('dataNotice').textContent='Chưa có PNG Clarity cho một hoặc cả hai tháng. Nhập bản xuất đúng URL và thiết bị trong phần cài đặt. Không thay thế bằng ảnh trang hiện tại.';
  $('scaleCaption').textContent='Màu gốc từng PNG · lưới theo pixel ảnh · chưa quy về cùng thang';$('cellTitle').textContent='Đối chiếu ảnh & selector';$('cellBody').replaceChildren(el('p','Các điểm chạm màu đã nằm trong PNG gốc. Chọn ô ảnh để ghi chú; đọc lượt chạm theo selector trong bảng.'));msg('');await loadNotes();
 }catch(e){if(id===requestId){invalidate();msg(e.message,true);}}finally{$('apply').disabled=false;}
}
function csv(){
 if(!report||!loaded)return;
 const escape=v=>`"${(typeof v==='number'?String(v):String(v??'').replace(/^[=+@\-]/,"'$&")).replace(/"/g,'""')}"`;
 const metadata=[report.source,loaded.siteId,loaded.path,loaded.device,loaded.version,loaded.width,loaded.versionB,loaded.widthB,loaded.monthA,loaded.monthB];
 const headers=['source','site_id','page','device','layout_a','width_a','layout_b','width_b','month_a','month_b'];
 let rows;
 if(report.comparableGeometry===false){
  const a=new Map(report.a.regions.map(r=>[r.key,r])),b=new Map(report.b.regions.map(r=>[r.key,r]));
  rows=[[...headers,'region','clicks_a','clicks_b','actions_a','actions_b','delta_per_100_views'],...[...new Set([...a.keys(),...b.keys()])].map(key=>[...metadata,key,archiveReport?a.get(key)?.clicks??null:a.get(key)?.clicks||0,archiveReport?b.get(key)?.clicks??null:b.get(key)?.clicks||0,archiveReport?null:a.get(key)?.actions||0,archiveReport?null:b.get(key)?.actions||0,report.a.summary.pageviews&&report.b.summary.pageviews&&(!archiveReport||a.has(key)&&b.has(key))?(a.get(key)?.per100Views||0)-(b.get(key)?.per100Views||0):null])];
 }else rows=[[...headers,'column','row','clicks_a','clicks_b','actions_a','actions_b','delta_per_100_views'],...report.deltas.map(d=>[...metadata,d.col,d.row,d.a,d.b,report.a.cells.find(c=>c.col===d.col&&c.row===d.row)?.actions||0,report.b.cells.find(c=>c.col===d.col&&c.row===d.row)?.actions||0,d.rateDelta])];
 const blob=new Blob(['\ufeff'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`dunnio-${loaded.monthA}-vs-${loaded.monthB}-${loaded.device}${demo?'-DEMO':''}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const id of ['site','page','device'])$(id).addEventListener('change',()=>id==='site'?fillPages():fillLayouts());
for(const id of ['pageType','pageSearch'])$(id).addEventListener(id==='pageSearch'?'input':'change',()=>{catalogOffset=0;fillPages();});
$('previousPages').addEventListener('click',()=>{catalogOffset=Math.max(0,catalogOffset-20);catalogTable();});$('nextPages').addEventListener('click',()=>{catalogOffset+=20;catalogTable();});
$('dataSource').addEventListener('change',()=>{invalidate();void loadReport();});
$('compareExports').addEventListener('click',compareExports);
$('refreshClarity').addEventListener('click',syncExport);
$('clarityDays').addEventListener('change',async()=>{if(demo)return;const days=$('clarityDays').value;try{const data=await api(`behavior/catalog?numOfDays=${days}`);if(days!==$('clarityDays').value)return;catalog=data;catalogTable();renderApiFields();}catch(e){msg(e.message,true);}});
$('discoverPages').addEventListener('click',async()=>{if(demo)return;$('discoverPages').disabled=true;try{const r=await api('behavior/discover',{method:'POST',body:JSON.stringify({siteId:Number($('site').value)})});await refreshCatalog();msg(`Đã đọc ${r.discovered} URL công khai; bổ sung ${r.added} trang.`);}catch(e){msg(e.message,true);}finally{$('discoverPages').disabled=false;}});
$('capturePage').addEventListener('click',async()=>{if(demo)return;const o=chosen();$('capturePage').disabled=true;msg('Đang tải CSS, font và ảnh theo từng viewport để chụp trang…');try{const r=await api('behavior/snapshot',{method:'POST',body:JSON.stringify({siteId:o.siteId,path:o.path,device:o.device,width:o.device==='mobile'?390:o.device==='tablet'?820:1440})});await refreshCatalog();$('layout').value=`${r.version}|${r.width}`;$('layoutB').value=$('layout').value;await loadReport();msg(`Đã lưu ảnh hiện tại ${r.width} × ${r.height}px. Ảnh này không đại diện bố cục lịch sử. ${r.quality.failedImages?`${r.quality.failedImages} ảnh nguồn chưa tải được.`:''}`);}catch(e){msg(e.message,true);}finally{$('capturePage').disabled=false;}});
$('archiveForm').addEventListener('submit',async e=>{e.preventDefault();if(demo)return;const form=e.target,o=chosen(),button=form.querySelector('button');button.disabled=true;try{
 const pngFile=form.elements.pngFile.files[0],csvFile=form.elements.csvFile.files[0];if(!pngFile||pngFile.size>10000000)throw new Error('Chọn PNG nhỏ hơn 10 MB');if(csvFile?.size>1000000)throw new Error('CSV phải nhỏ hơn 1 MB');
 const png=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(pngFile);});
 const total=k=>form.elements[k].value===''?null:Number(form.elements[k].value);
 await api('behavior/heatmap-import',{method:'POST',body:JSON.stringify({siteId:o.siteId,path:o.path,device:form.elements.device.value,month:form.elements.month.value,png,csv:csvFile?await csvFile.text():'',name:pngFile.name,pageviews:total('pageviews'),clicks:total('clicks')})});
 $('device').value=form.elements.device.value;fillLayouts();$('dataSource').value='archive';$('monthA').value=form.elements.month.value;await loadReport();msg('Đã lưu bản xuất Clarity, giữ nguyên PNG và dữ liệu selector.');
 }catch(err){msg(err.message,true);}finally{button.disabled=false;}});
for(const id of ['layout','layoutB','startA','endA','startB','endB'])$(id).addEventListener('change',()=>{invalidate();installCode();});
$('apply').addEventListener('click',loadReport);$('export').addEventListener('click',csv);
document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>x.classList.toggle('selected',x===b));if(report)render();}));
$('normalization').addEventListener('change',()=>{if(report)render();});
$('zoom').addEventListener('change',()=>{if(report)render();});
$('gridToggle').addEventListener('change',()=>document.querySelectorAll('.map-content svg').forEach(s=>s.classList.toggle('grid-off',!$('gridToggle').checked)));
let synchronizing=false;for(const [from,to] of [['scrollA','scrollB'],['scrollB','scrollA']])$(from).addEventListener('scroll',()=>{if(!$('syncToggle').checked||synchronizing)return;synchronizing=true;$(to).scrollTop=$(from).scrollTop;requestAnimationFrame(()=>{synchronizing=false;});},{passive:true});
$('noteForm').addEventListener('submit',async e=>{e.preventDefault();if(!loaded||!selected||demo)return;$('saveNote').disabled=true;try{await api('behavior/notes',{method:'POST',body:JSON.stringify({...loaded,...selected,text:$('noteText').value})});$('noteText').value='';msg('Đã lưu đề xuất cho Dev và Content Editor.');await loadNotes();}catch(e){msg(e.message,true);}finally{$('saveNote').disabled=!selected;}});
$('copyInstall').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('installCode').textContent);msg('Đã sao chép đoạn cài đặt. Thay endpoint localhost bằng domain HTTPS của tracker trước khi dùng trên website.');}catch{msg('Trình duyệt chưa cấp clipboard. Bạn có thể chọn và sao chép đoạn mã.',true);}});
$('logout').addEventListener('click',()=>{for(const s of [localStorage,sessionStorage]){s.removeItem('auth_token');s.removeItem('user_data');}location.href='login.html';});
$('syncClarity').addEventListener('click',syncExport);
for(const [id,endpoint] of [['siteForm','behavior/sites'],['pageForm','behavior/pages']])$(id).addEventListener('submit',async e=>{
 e.preventDefault();if(demo){msg('Đăng nhập để đăng ký website hoặc trang.',true);return;}
 const data=Object.fromEntries(new FormData(e.target));if(id==='siteForm')data.goalPaths=data.goalPaths.split('\n').map(s=>s.trim()).filter(Boolean);else data.siteId=Number($('site').value);
 try{await api(endpoint,{method:'POST',body:JSON.stringify(data)});catalog=await api('behavior/catalog');$('site').replaceChildren(...catalog.sites.map(s=>option(s.id,s.name)));fillPages();msg('Đã đăng ký. Cấu hình script và chụp ảnh đúng phiên bản để bắt đầu phân tích.');}catch(e){msg(e.message,true);}
});
async function init(){
 if(!demo&&!token){location.href='login.html';return;}
 $('demoBanner').hidden=!demo;$('sourceLabel').textContent=demo?'● Dữ liệu minh họa':'Clarity API + tracker riêng';$('sourceLabel').classList.toggle('demo',demo);
 try{
  if(!demo){currentUser=await api('auth/me');$('identity').replaceChildren(document.createTextNode(currentUser.username),el('small',currentUser.role));$('syncClarity').disabled=!['admin','dev'].includes(currentUser.role);}
  catalog=await api(`${demo?'demo':'behavior'}/catalog`);
  if(catalog.clarity)$('clarityDays').value=String(catalog.clarity.numOfDays);
  if(!catalog.sites.length)throw new Error('Chưa có website được đăng ký');
  if(demo)$('device').querySelector('[value=tablet]').disabled=true;
  // Set default date ranges BEFORE fillPages/loadReport to avoid empty params on first chosen() call
  if(!demo){const now=new Date();const fmt=y=>`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;const d0=new Date(now);const d1=new Date(now);d1.setDate(d1.getDate()-30);const d2=new Date(now);d2.setDate(d2.getDate()-31);const d3=new Date(d2);d3.setDate(d3.getDate()-30);$('startA').value=fmt(d1);$('endA').value=fmt(d0);$('startB').value=fmt(d3);$('endB').value=fmt(d2);}
  $('site').replaceChildren(...catalog.sites.map(s=>option(s.id,s.name)));fillPages();
  if(chosen().version)await loadReport();else msg('Chưa có dữ liệu tracking. Xem phần cài đặt để kết nối trang được chọn.');
  if(!demo){const status=await api('clarity/status');$('clarityLabel').textContent=status.configured?`Clarity · ${status.projectId} · đã cấu hình`:'Clarity · chưa cấu hình token trên server';if(status.projectId)$('openClarity').href=`https://clarity.microsoft.com/projects/view/${encodeURIComponent(status.projectId)}/heatmaps`;await loadExportHistory();}else $('clarityLabel').textContent='Clarity · chưa kết nối trong minh họa';
  const writer=!demo&&['admin','dev'].includes(currentUser?.role);for(const id of ['capturePage','discoverPages','refreshClarity'])$(id).disabled=!writer;for(const element of $('archiveForm').elements)element.disabled=!writer;
 }catch(e){msg(e.message,true);}
}
void init();
