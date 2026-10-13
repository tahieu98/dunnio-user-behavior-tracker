'use strict';
const $=id=>document.getElementById(id);
const token=sessionStorage.getItem('auth_token')||localStorage.getItem('auth_token');
let catalog=null,reports=[],comparison=null,currentRun=null,guideJob=null,importJob=null,canWrite=false,selectedKey=null,armed=false,anchor=null,trendOffset=0;
let reportRequest=0,runRequest=0,comparisonRequest=0;
const selectedPages=new Set(),selectedReports=new Set();
const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(n);
const signed=n=>n===null||n===undefined?'—':`${n>0?'+':''}${fmt(n)}`;
const range=r=>`${r.start_date} → ${r.end_date}`;
const states={pending:'Chưa lấy',reading:'Đang đọc',imported:'Đã nhập',skipped:'Bỏ qua',failed:'Chưa lấy được'};
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function option(value,label){const e=el('option',label);e.value=value;return e;}
function msg(text,error=false){$('message').textContent=text;$('message').className=error?'error':'';}
function button(text,fn,write=false){const e=el('button',text);e.type='button';e.disabled=write&&!canWrite;e.addEventListener('click',()=>void act(fn));return e;}
async function act(fn){try{await fn();}catch(e){msg(e.message,true);}}
async function api(path,options={}){
 const r=await fetch(`/api/${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
 const b=await r.json();if(r.status===401){sessionStorage.removeItem('auth_token');localStorage.removeItem('auth_token');location.href='login.html';throw new Error('Phiên đăng nhập đã hết hạn');}
 if(!r.ok||!b.success)throw new Error(b.message||'Không thể thực hiện yêu cầu');return b.data;
}
const post=(path,b)=>api(path,{method:'POST',body:JSON.stringify(b)});
function download(name,text,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function copy(text){try{await navigator.clipboard.writeText(text);msg('Đã sao chép.');}catch{msg('Không sao chép được. Bạn có thể chọn văn bản đang hiển thị để sao chép.',true);}}
function cohort(){return {siteId:Number($('site').value),projectId:$('projectId').value.trim(),device:$('device').value,heatmapType:$('heatmapType').value,segment:$('segment').value.trim(),timezone:$('timezone').value.trim()};}
function detach(){importJob=null;$('importJob').textContent='Nhập độc lập cho trang đang chọn.';}
function invalidate(){
 comparisonRequest++;comparison=null;selectedKey=null;anchor=null;armed=false;document.body.classList.remove('armed');
 $('export').disabled=true;$('compareGroups').disabled=true;$('clearGroups').disabled=true;$('armAnchor').disabled=true;$('saveAnchor').disabled=true;$('clearAnchor').disabled=true;
 $('mapA').replaceChildren();$('mapB').replaceChildren();$('warnings').hidden=true;$('trendTable').querySelector('thead').replaceChildren();
 const tr=el('tr');tr.append(el('td','Chọn ít nhất hai bản xuất để xem xu hướng.'));$('trendTable').querySelector('tbody').replaceChildren(tr);
 for(const id of ['panelA','panelB','groupA','groupB','anchorReport'])$(id).replaceChildren();
 $('trendCount').textContent='';$('elementDetail').textContent='Chọn một phần tử trong bảng để xem số lượt và đánh dấu vị trí trên từng ảnh.';
}
function pages(){const q=$('pageSearch').value.trim().toLowerCase();return (catalog?.pages||[]).filter(p=>p.site_id===Number($('site').value)&&`${p.title} ${p.page_path}`.toLowerCase().includes(q));}
function renderPages(){
 const all=pages(),shown=all.slice(0,50);
 $('pageList').replaceChildren(...shown.map(p=>{
  const label=el('label',undefined,'page-item'),check=el('input');check.type='checkbox';check.checked=selectedPages.has(p.page_path);
  const text=el('span',p.title);text.append(el('small',p.page_path));check.addEventListener('change',()=>{if(check.checked)selectedPages.add(p.page_path);else selectedPages.delete(p.page_path);renderPages();});label.append(check,text);return label;
 }));
 if(!shown.length)$('pageList').append(el('p','Chưa có URL phù hợp. Bạn có thể đăng ký trang bên dưới.'));
 $('pageCount').textContent=`${selectedPages.size} đã chọn · ${shown.length}/${all.length} kết quả; tìm để chọn trang khác`;
}
function fillPages(old){
 const list=catalog.pages.filter(p=>p.site_id===Number($('site').value));$('page').replaceChildren(...list.map(p=>option(p.page_path,`${p.title} · ${p.page_path}`)));
 if(list.some(p=>p.page_path===old))$('page').value=old;renderPages();
}
function addPeriod(start='',end=''){
 if($('periods').children.length>=12){msg('Tối đa 12 khoảng ngày.',true);return;}
 const row=el('div',undefined,'period-row'),a=el('label','Từ ngày'),b=el('label','Đến ngày'),ai=el('input'),bi=el('input');
 ai.type=bi.type='date';ai.value=start;bi.value=end;ai.required=bi.required=true;a.append(ai);b.append(bi);
 row.append(a,b,button('×',()=>row.remove()));row.lastChild.setAttribute('aria-label','Bỏ khoảng ngày');$('periods').append(row);
}
function periods(){return [...$('periods').children].map(r=>{const i=r.querySelectorAll('input');return {start:i[0].value,end:i[1].value};});}
async function loadRuns(){
 const seq=++runRequest,siteId=$('site').value,old=$('run').value;
 const rows=await api(`clarity-workspace/runs?siteId=${encodeURIComponent(siteId)}`);if(seq!==runRequest)return;
 $('run').replaceChildren(...rows.map(r=>option(r.id,`${r.name} · ${r.imported}/${r.jobs} đã nhập`)));
 if(rows.some(r=>String(r.id)===old))$('run').value=old;
 await loadRun();
}
async function loadRun(){
 const seq=++runRequest;guideJob=null;$('jobGuide').hidden=true;currentRun=null;$('manifest').disabled=true;
 if(!$('run').value){$('jobRows').replaceChildren();$('runProgress').textContent='Chưa có đợt thu thập.';return;}
 const data=await api(`clarity-workspace/runs/${$('run').value}`);if(seq!==runRequest)return;currentRun=data;$('manifest').disabled=false;
 const done=data.jobs.filter(j=>j.status==='imported').length;$('runProgress').textContent=`${done}/${data.jobs.length} đã nhập · ${data.device} · ${data.heatmap_type}`;
 $('jobRows').replaceChildren(...data.jobs.map(j=>{
  const tr=el('tr'),url=el('td',j.page_path),status=el('td'),actions=el('td');status.append(el('span',states[j.status],`state ${j.status}`));if(j.note)status.append(el('small',j.note));
  actions.append(button(j.status==='imported'?'Xem hướng dẫn':'Mở mục',()=>showJob(j)),button('Nhập file',()=>useJob(j),true));
  if(j.status!=='imported')actions.append(button('Chưa lấy được',async()=>{await api(`clarity-workspace/jobs/${j.id}`,{method:'PATCH',body:JSON.stringify({status:'failed',note:'Chưa lấy được bản xuất; giữ nguyên dữ liệu thiếu.'})});await loadRuns();},true));
  tr.append(url,el('td',range(j)),status,actions);return tr;
 }));
}
function showJob(j){guideJob=j;$('jobGuide').hidden=false;$('jobTitle').textContent=`${j.page_path} · ${range(j)}`;$('jobInstructions').textContent=j.instructions;$('portalLink').href=j.portalUrl;}
async function useJob(j){
 const r=currentRun;if(!r)return;
 if(Number($('site').value)!==r.site_id){$('site').value=r.site_id;fillPages(j.page_path);}
 $('page').value=j.page_path;$('projectId').value=r.project_id;$('device').value=r.device;$('heatmapType').value=r.heatmap_type;$('segment').value=r.segment;$('timezone').value=r.timezone;
 const f=$('importForm');f.reset();f.elements.start.value=j.start_date;f.elements.end.value=j.end_date;importJob={...j,run:r};
 $('importJob').textContent=`Mục #${j.id} · ${j.url} · ${range(j)}. File phải khớp bộ lọc của hàng đợi.`;
 await loadReports();$('imports').scrollIntoView({behavior:'smooth'});
 if(j.status!=='imported'&&canWrite){await api(`clarity-workspace/jobs/${j.id}`,{method:'PATCH',body:JSON.stringify({status:'reading'})});await loadRuns();}
}
async function loadReports(){
 const seq=++reportRequest;invalidate();selectedReports.clear();$('compare').disabled=true;
 const o=cohort();if(!$('page').value){reports=[];renderReports();return;}
 const data=await api(`clarity-workspace/reports?${new URLSearchParams({siteId:o.siteId,path:$('page').value,device:o.device})}`);if(seq!==reportRequest)return;reports=data;renderReports();
}
function renderReports(){
 $('reportCount').textContent=`${reports.length} bản · ${selectedReports.size} đã chọn`;
 $('reportRows').replaceChildren(...reports.map(r=>{
  const tr=el('tr'),choose=el('td'),check=el('input');check.type='checkbox';check.checked=selectedReports.has(r.id);check.setAttribute('aria-label',`Chọn bản ${r.id} ${range(r)}`);
  check.addEventListener('change',()=>{if(check.checked&&selectedReports.size>=12){check.checked=false;msg('Tối đa 12 bản xuất trong một báo cáo.',true);return;}if(check.checked)selectedReports.add(r.id);else selectedReports.delete(r.id);$('compare').disabled=selectedReports.size<2;$('reportCount').textContent=`${reports.length} bản · ${selectedReports.size} đã chọn`;invalidate();});choose.append(check);
  const period=el('td',range(r));period.append(el('small',`#${r.id} · ${r.export_name}`));
  const filters=el('td',`${r.device} · ${r.heatmap_type}`);filters.append(el('small',`Project: ${r.project_id||'chưa khai báo (kho cũ)'} · ${r.timezone} · ${r.segment||'không có segment'}`));
  const count=el('td',r.csv_status==='parsed'?fmt(r.selector_counts.length):'—');count.append(el('small',r.csv_status==='parsed'?(r.complete_export?'CSV xác nhận đầy đủ':'CSV chưa xác nhận đầy đủ'):r.csv_status==='legacy'?'Dữ liệu kho cũ':r.csv_status==='none'?'Chỉ có ảnh':`CSV cần kiểm tra (${r.csv_status})`));
  const files=el('td');if(r.image_path){const a=el('a','PNG');a.href=r.image_path;a.target='_blank';a.rel='noopener';files.append(a);}files.append(button('CSV gốc',async()=>{const full=await api(`clarity-workspace/reports/${r.id}`);if(!full.raw_csv)throw new Error('Bản này không có CSV gốc.');download(`Clarity-${r.id}.csv`,full.raw_csv,'text/csv;charset=utf-8');}));
  tr.append(choose,period,filters,el('td',fmt(r.pageviews)),count,files);return tr;
 }));
 if(!reports.length){const tr=el('tr'),td=el('td','Chưa có bản xuất cho URL và thiết bị này. Tải CSV/PNG từ Clarity rồi nhập ở trên.');td.colSpan=6;tr.append(td);$('reportRows').append(tr);}
}
async function compare(groups){
 const seq=++comparisonRequest;
 const data=await post('clarity-workspace/compare',{reportIds:[...selectedReports],...(groups?{groups}:{})});if(seq!==comparisonRequest)return;
 comparison=data;trendOffset=0;selectedKey=null;anchor=null;armed=false;document.body.classList.remove('armed');
 $('warnings').replaceChildren(...data.warnings.map(w=>el('p',w)));$('warnings').hidden=!data.warnings.length;$('export').disabled=false;
 $('compareGroups').disabled=false;$('clearGroups').disabled=false;
 const oldA=$('panelA').value,oldB=$('panelB').value;
 for(const id of ['panelA','panelB','groupA','groupB'])$(id).replaceChildren(...data.reports.map(r=>option(r.id,`#${r.id} · ${range(r)}`)));
 $('panelA').value=data.reports.some(r=>String(r.id)===oldA)?oldA:data.reports[0].id;
 $('panelB').value=data.reports.some(r=>String(r.id)===oldB)?oldB:data.reports.at(-1).id;
 if(data.grouped){for(const o of $('groupA').options)o.selected=data.grouped.a.includes(Number(o.value));for(const o of $('groupB').options)o.selected=data.grouped.b.includes(Number(o.value));}
 renderTrends();renderMaps();selectElement(null);$('comparison').scrollIntoView({behavior:'smooth'});msg('Đã đối chiếu dữ liệu. Số lượt thiếu được giữ là chưa xác định.');
}
function changeText(c){if(c.state==='missing')return 'Chưa xác định';if(c.state==='new')return `${signed(c.delta)} · phát sinh từ 0`;return `${signed(c.delta)} · ${c.percent===null?'—':signed(c.percent)+'%'}`;}
function renderTrends(){
 if(!comparison)return;
 const search=$('elementSearch').value.trim().toLowerCase(),trend=$('trend').value;
 const rows=comparison.rows.filter(r=>r.key.toLowerCase().includes(search)&&(trend==='all'||(r.grouped||r.overall).state===trend));
 trendOffset=Math.min(trendOffset,Math.max(0,Math.ceil(rows.length/100)-1)*100);
 $('trendCount').textContent=`${Math.min(rows.length,trendOffset+1)}–${Math.min(rows.length,trendOffset+100)} / ${rows.length} phần tử`;
 $('previousTrends').disabled=trendOffset===0;$('nextTrends').disabled=trendOffset+100>=rows.length;
 const head=el('tr');head.append(el('th','Phần tử / khóa ghép'));
 for(const r of comparison.reports)head.append(el('th',`#${r.id} · ${range(r)}`));
 for(let i=1;i<comparison.reports.length;i++)head.append(el('th',`Δ #${comparison.reports[i-1].id} → #${comparison.reports[i].id}`));
 if(comparison.grouped){head.append(el('th','Tổng nhóm A'),el('th','Tổng nhóm B'),el('th','Δ B − A'));}else head.append(el('th','Δ kỳ cuối − kỳ đầu'));
 $('trendTable').querySelector('thead').replaceChildren(head);
 $('trendTable').querySelector('tbody').replaceChildren(...rows.slice(trendOffset,trendOffset+100).map(r=>{
  const tr=el('tr');tr.classList.toggle('selected',r.key===selectedKey);const name=el('td');name.append(button(r.key,()=>selectElement(r.key)));
  tr.append(name);for(const p of r.points){const td=el('td',p.count===null?'Chưa xác định':fmt(p.count));td.append(el('small',`${fmt(p.per100Views)} / 100 xem`));tr.append(td);}
  for(const c of r.changes){const td=el('td',changeText(c),c.state);td.append(el('small',`Δ ${signed(c.rateDelta)} / 100 xem`));tr.append(td);}
  if(r.grouped){for(const side of ['A','B']){const td=el('td',fmt(r.grouped[side.toLowerCase()]));td.append(el('small',`${fmt(r.grouped['per100Views'+side])} / 100 xem`));tr.append(td);}const td=el('td',changeText(r.grouped),r.grouped.state);td.append(el('small',`Δ ${signed(r.grouped.rateDelta)} / 100 xem`));tr.append(td);}else tr.append(el('td',changeText(r.overall),r.overall.state));return tr;
 }));
 if(!rows.length){const tr=el('tr'),td=el('td','Không có phần tử phù hợp hoặc CSV chưa cung cấp số liệu đọc được.');td.colSpan=head.children.length;tr.append(td);$('trendTable').querySelector('tbody').append(tr);}
}
function svg(tag,attrs={}){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
function renderMaps(){for(const side of ['A','B'])renderMap(side);}
function renderMap(side){
 const box=$(`map${side}`),r=comparison?.reports.find(r=>r.id===Number($(`panel${side}`).value));box.replaceChildren();box.style.width=`${Number($('zoom').value)*100}%`;box.style.minHeight='0';
 $(`title${side}`).textContent=r?`#${r.id} · ${range(r)} · ${r.device}`:`Ảnh ${side}`;
 if(!r?.image_path){box.append(el('div','Bản này chưa có PNG. Số liệu CSV vẫn được đối chiếu ở bảng.','map-empty'));return;}
 const img=el('img');img.src=r.image_path;img.alt=`Heatmap Clarity ${r.page_path}, ${range(r)}`;
 img.addEventListener('load',()=>{if(img.naturalWidth!==r.image_width||img.naturalHeight!==r.image_height){box.replaceChildren(el('div','Ảnh không khớp kích thước đã lưu; tạm dừng lưới để tránh đánh dấu sai.','map-empty'));}});
 img.addEventListener('error',()=>box.replaceChildren(el('div','Không tải được PNG đã lưu.','map-empty')));
 const overlay=svg('svg',{viewBox:`0 0 ${r.image_width} ${r.image_height}`,'aria-hidden':'true',preserveAspectRatio:'none'});
 if($('gridToggle').checked){for(let c=1;c<12;c++)overlay.append(svg('line',{x1:r.image_width*c/12,y1:0,x2:r.image_width*c/12,y2:r.image_height,stroke:'#436274','stroke-opacity':'.35','stroke-width':1}));for(let y=50;y<r.image_height;y+=50)overlay.append(svg('line',{x1:0,y1:y,x2:r.image_width,y2:y,stroke:'#436274','stroke-opacity':'.25','stroke-width':1}));}
 const positions=[...r.anchors];if(anchor?.reportId===r.id&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.y)){const i=positions.findIndex(a=>a.key===anchor.key);if(i>=0)positions[i]=anchor;else positions.push(anchor);}
 for(const a of positions){const s=r.selector_counts.find(s=>s.key===a.key);if(!s)continue;const row=comparison.rows.find(row=>row.points.some(p=>p.reportId===r.id&&p.selector===a.key));
  const g=svg('g'),circle=svg('circle',{cx:a.x,cy:a.y,r:17,class:`anchor-bubble${row?.key===selectedKey?' selected':''}`}),text=svg('text',{x:a.x,y:a.y+4,'text-anchor':'middle',fill:'#fff','font-size':12}),title=svg('title');text.textContent=String(s.count);title.textContent=`${a.label||a.key}: ${s.count} lượt với phần tử · điểm neo do người phân tích xác nhận`;g.append(title,circle,text);overlay.append(g);
 }
 box.append(img,overlay);
 img.addEventListener('click',e=>{
  const b=img.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*r.image_width,y=(e.clientY-b.top)/b.height*r.image_height;
  if(armed&&selectedKey&&canWrite){const row=comparison.rows.find(row=>row.key===selectedKey),point=row.points.find(p=>p.reportId===r.id);if(!point?.selector){msg('Phần tử này chưa có số liệu trong bản đang đánh dấu.',true);return;}
   $('anchorReport').value=r.id;anchor={reportId:r.id,key:point.selector,x:Math.min(r.image_width-1,Math.max(0,x)),y:Math.min(r.image_height-1,Math.max(0,y))};$('anchorX').value=anchor.x.toFixed(2);$('anchorY').value=anchor.y.toFixed(2);armed=false;document.body.classList.remove('armed');$('saveAnchor').disabled=false;$('anchorNotice').textContent=`Điểm neo C${Math.floor(x/r.image_width*12)+1} · R${Math.floor(y/50)+1} · X ${fmt(x)}, Y ${fmt(y)}. Xác nhận và bấm Lưu để giữ vị trí.`;renderMaps();
  }else{const near=positions.find(a=>Math.hypot((a.x-x)/r.image_width*b.width,(a.y-y)/r.image_height*b.height)<22);if(near){const row=comparison.rows.find(row=>row.points.some(p=>p.reportId===r.id&&p.selector===near.key));if(row)selectElement(row.key);}}
 });
}
function selectElement(key){
 selectedKey=key;anchor=null;armed=false;document.body.classList.remove('armed');$('anchorConfirmed').checked=false;
 const row=comparison?.rows.find(r=>r.key===key);$('armAnchor').disabled=!row||!canWrite;$('saveAnchor').disabled=true;$('clearAnchor').disabled=true;
 $('elementDetail').textContent=row?`${row.key} · ${row.points.map(p=>`#${p.reportId}: ${fmt(p.count)} lượt`).join(' · ')}`:'Chọn một phần tử trong bảng để xem số lượt và đánh dấu vị trí trên từng ảnh.';
 const rs=row?comparison.reports.filter(r=>r.image_path&&row.points.some(p=>p.reportId===r.id&&p.selector)):[];
 $('anchorReport').replaceChildren(...rs.map(r=>option(r.id,`#${r.id} · ${range(r)}`)));$('armAnchor').disabled=!rs.length||!canWrite;
 chooseAnchor();renderTrends();renderMaps();
}
function chooseAnchor(){
 const r=comparison?.reports.find(r=>r.id===Number($('anchorReport').value)),row=comparison?.rows.find(r=>r.key===selectedKey),point=row?.points.find(p=>p.reportId===r?.id),existing=r?.anchors.find(a=>a.key===point?.selector);
 anchor=point?.selector?{reportId:r.id,key:point.selector,x:existing?.x??null,y:existing?.y??null}:null;
 $('anchorX').value=existing?.x??'';$('anchorY').value=existing?.y??'';$('anchorLabel').value=existing?.label||'';$('matchKey').value=existing?.matchKey||'';$('anchorConfirmed').checked=false;
 $('anchorNotice').textContent=existing?`Điểm neo đã lưu: X ${fmt(existing.x)}, Y ${fmt(existing.y)}. Số lượt thuộc phần tử, không phải pixel được đánh dấu.`:'Điểm neo do người phân tích xác nhận; số lượt thuộc phần tử, không phải số lượt tại pixel được đánh dấu.';
 $('saveAnchor').disabled=!existing||!canWrite;$('clearAnchor').disabled=!existing||!canWrite;renderMaps();
}
async function saveAnchor(remove=false){
 if(!anchor||!$('anchorConfirmed').checked)throw new Error('Xác nhận phần tử và vị trí trước khi lưu.');
 const r=comparison.reports.find(r=>r.id===anchor.reportId),x=$('anchorX').value,y=$('anchorY').value;
 const entries=r.anchors.filter(a=>a.key!==anchor.key);
 if(!remove){if(x===''||y==='')throw new Error('Nhập X/Y hoặc đánh dấu vị trí trên ảnh.');entries.push({key:anchor.key,x:Number(x),y:Number(y),label:$('anchorLabel').value,matchKey:$('matchKey').value});}
 await api(`clarity-workspace/reports/${r.id}/anchors`,{method:'PATCH',body:JSON.stringify({anchors:entries,confirmed:true})});
 const nextKey=!remove&&$('matchKey').value.trim()?$('matchKey').value.trim():selectedKey;
 const groups=comparison.grouped?{a:comparison.grouped.a,b:comparison.grouped.b}:undefined;await compare(groups);if(comparison.rows.some(row=>row.key===nextKey))selectElement(nextKey);msg(remove?'Đã gỡ điểm neo.':'Đã lưu điểm neo của phần tử.');
}
async function importReport(e){
 e.preventDefault();const f=e.currentTarget,csv=f.elements.csvFile.files[0],png=f.elements.pngFile.files[0];
 if(!csv&&!png)throw new Error('Chọn CSV hoặc PNG của Clarity.');if(csv?.size>1000000||png?.size>10000000)throw new Error('Giới hạn: CSV 1 MB; PNG 10 MB.');
 const data={...cohort(),path:$('page').value,start:f.elements.start.value,end:f.elements.end.value,name:[csv?.name,png?.name].filter(Boolean).join(' + ').slice(0,255),confirmed:f.elements.confirmed.checked,completeExport:f.elements.complete.checked,pageviews:f.elements.pageviews.value===''?null:Number(f.elements.pageviews.value),clicks:f.elements.clicks.value===''?null:Number(f.elements.clicks.value),jobId:importJob?.id||null};
 const submit=f.querySelector('[type=submit]');submit.disabled=true;
 try{
  data.csv=csv?await csv.text():'';
  if(png)data.png=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Không đọc được PNG'));reader.readAsDataURL(png);});
  const r=await post('clarity-workspace/reports',data);await loadReports();await loadRuns();f.reset();detach();msg(`Đã lưu bản #${r.id}${r.duplicate?' (đã có trong kho)':''}. ${r.warning||''}`,!!r.warning);
 }finally{submit.disabled=!canWrite;}
}
function exportCsv(){
 if(!comparison)return;
 const header=['element'];for(const r of comparison.reports)header.push(`#${r.id} ${range(r)} count`,`#${r.id} per_100_views`);
 for(let i=1;i<comparison.reports.length;i++)header.push(`delta_${i}`,`percent_${i}`,`rate_delta_${i}`);header.push('overall_delta','overall_percent');
 if(comparison.grouped)header.push('group_A','group_B','group_delta','group_percent','group_rate_delta');
 const rows=[['source','clarity-portal-export'],['page',comparison.reports[0].page_path],['project',comparison.reports[0].project_id],['device',comparison.reports[0].device],['heatmap',comparison.reports[0].heatmap_type],['segment',comparison.reports[0].segment],['timezone',comparison.reports[0].timezone],['warnings',comparison.warnings.join(' | ')]];
 if(comparison.grouped)rows.push(['group_A_reports',comparison.grouped.a.join(',')],['group_B_reports',comparison.grouped.b.join(',')]);rows.push(header);
 for(const r of comparison.rows){const cells=[r.key];for(const p of r.points)cells.push(p.count,p.per100Views);for(const c of r.changes)cells.push(c.delta,c.percent,c.rateDelta);cells.push(r.overall.delta,r.overall.percent);if(r.grouped)cells.push(r.grouped.a,r.grouped.b,r.grouped.delta,r.grouped.percent,r.grouped.rateDelta);rows.push(cells);}
 const escape=v=>`"${(typeof v==='number'?String(v):String(v??'').replace(/^[=+@\-]/,"'$&")).replace(/"/g,'""')}"`;
 download(`Dunnio-Clarity-${comparison.reports.map(r=>r.id).join('-')}.csv`,'\ufeff'+rows.map(r=>r.map(escape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
$('logout').addEventListener('click',()=>{sessionStorage.removeItem('auth_token');localStorage.removeItem('auth_token');location.href='login.html';});
$('pageSearch').addEventListener('input',renderPages);
$('selectPages').addEventListener('click',()=>{const next=new Set([...selectedPages,...pages().slice(0,50).map(p=>p.page_path)]);if(next.size>50){msg('Tối đa 50 URL trong một đợt. Bỏ bớt URL đã chọn.',true);return;}for(const p of next)selectedPages.add(p);renderPages();});
$('clearPages').addEventListener('click',()=>{selectedPages.clear();renderPages();});
$('addPeriod').addEventListener('click',()=>addPeriod());
$('site').addEventListener('change',()=>void act(async()=>{detach();selectedPages.clear();fillPages();await loadRuns();await loadReports();}));
for(const id of ['projectId','device','heatmapType','segment','timezone'])$(id).addEventListener('change',()=>void act(async()=>{detach();await loadReports();}));
$('page').addEventListener('change',()=>void act(async()=>{detach();await loadReports();}));
$('createRun').addEventListener('click',()=>void act(async()=>{const b=$('createRun');b.disabled=true;try{const r=await post('clarity-workspace/runs',{...cohort(),name:$('runName').value,paths:[...selectedPages],periods:periods()});await loadRuns();$('run').value=r.id;await loadRun();msg(`Đã tạo ${r.jobs} mục thu thập. Chọn Mở mục để xem bộ lọc và hướng dẫn.`);}finally{b.disabled=!canWrite;}}));
$('run').addEventListener('change',()=>void act(loadRun));$('refreshRuns').addEventListener('click',()=>void act(loadRuns));
$('copyGuide').addEventListener('click',()=>void copy(guideJob?.instructions||''));$('useJob').addEventListener('click',()=>void act(()=>useJob(guideJob)));
$('manifest').addEventListener('click',()=>{if(currentRun)download(`Clarity-collection-${currentRun.id}.json`,JSON.stringify(currentRun,null,2),'application/json');});
$('detachJob').addEventListener('click',detach);$('importForm').addEventListener('submit',e=>void act(()=>importReport(e)));
$('pageForm').addEventListener('submit',e=>{e.preventDefault();void act(async()=>{const f=e.currentTarget;await post('behavior/pages',{siteId:Number($('site').value),url:f.elements.url.value,title:f.elements.title.value,category:'other'});catalog=await api('clarity-workspace/catalog');fillPages(new URL(f.elements.url.value).pathname);f.reset();await loadReports();msg('Đã đăng ký URL.');});});
$('refreshReports').addEventListener('click',()=>void act(loadReports));$('compare').addEventListener('click',()=>void act(()=>compare()));
$('compareGroups').addEventListener('click',()=>void act(()=>compare({a:[...$('groupA').selectedOptions].map(o=>Number(o.value)),b:[...$('groupB').selectedOptions].map(o=>Number(o.value))})));
$('clearGroups').addEventListener('click',()=>void act(()=>compare()));
for(const id of ['elementSearch','trend'])$(id).addEventListener(id==='elementSearch'?'input':'change',()=>{trendOffset=0;renderTrends();});
$('previousTrends').addEventListener('click',()=>{trendOffset=Math.max(0,trendOffset-100);renderTrends();});$('nextTrends').addEventListener('click',()=>{trendOffset+=100;renderTrends();});
for(const id of ['panelA','panelB','gridToggle','zoom'])$(id).addEventListener('change',renderMaps);
$('anchorReport').addEventListener('change',chooseAnchor);
$('armAnchor').addEventListener('click',()=>{armed=true;document.body.classList.add('armed');$('anchorNotice').textContent='Bấm vào vị trí phần tử trên ảnh A/B. Điểm neo chưa được lưu cho đến khi bạn xác nhận và bấm Lưu.';});
for(const id of ['anchorX','anchorY'])$(id).addEventListener('input',()=>{if(anchor){anchor.x=$('anchorX').value===''?null:Number($('anchorX').value);anchor.y=$('anchorY').value===''?null:Number($('anchorY').value);$('saveAnchor').disabled=!canWrite||anchor.x===null||anchor.y===null;renderMaps();}});
$('saveAnchor').addEventListener('click',()=>void act(()=>saveAnchor()));$('clearAnchor').addEventListener('click',()=>void act(()=>saveAnchor(true)));$('export').addEventListener('click',exportCsv);
async function init(){
 if(!token){location.href='login.html';return;}
 const user=await api('auth/me');canWrite=['admin','dev'].includes(user.role);$('identity').textContent=user.username;
 document.querySelectorAll('[data-write]').forEach(e=>e.disabled=!canWrite||['armAnchor','saveAnchor','clearAnchor'].includes(e.id));
 catalog=await api('clarity-workspace/catalog');$('projectId').value=catalog.projectId;$('site').replaceChildren(...catalog.sites.map(s=>option(s.id,s.name)));fillPages();
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
 for(const offset of [-3,-2,-1,0]){const d=new Date(Date.UTC(year,month-1+offset,0)),last=d.toISOString().slice(0,10);addPeriod(last.slice(0,7)+'-01',last);}
 if(!catalog.sites.length){msg('Chưa có website. Đăng ký website trong màn hình quản trị.',true);return;}
 await loadRuns();await loadReports();
}
void act(init);
