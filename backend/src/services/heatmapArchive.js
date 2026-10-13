'use strict';
const crypto=require('crypto'),fs=require('fs/promises'),path=require('path');
const {query}=require('../config/database');
const {cleanPath,monthBounds,invalid}=require('./behaviorMath');
const {writeAsset}=require('./snapshotCapture');
function csvRows(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>1000000)invalid('CSV must be smaller than 1 MB');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.trim())invalid('Malformed CSV quoting');else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';if(c==='\r'&&text[i+1]==='\n')i++;}
  else cell+=c;
  if(rows.length>5000||cell.length>20000)invalid('CSV too large');
 }
 if(quoted)invalid('Unclosed CSV quote');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
function selectorsFromCsv(text){
 if(!text?.trim())return [];
 const rows=csvRows(text.replace(/^\uFEFF/,'')),header=rows.shift()?.map(v=>v.toLowerCase().replace(/[^a-z]/g,''))||[];
 const selector=header.findIndex(v=>['selector','cssselector','element','elementselector','elementname'].includes(v));
 const count=header.findIndex(v=>['clicks','clickcount','numberofclicks','noofclicks','totalclicks','taps','tapcount'].includes(v));
 if(selector<0||count<0)invalid('CSV chưa có cột Selector/Element và Clicks/Click count được hỗ trợ. Bạn có thể nhập PNG trước, hoặc giữ nguyên file CSV để bổ sung đúng định dạng.');
 const result=[];
 for(const row of rows){const key=row[selector]?.trim(),raw=row[count]?.trim().replace(/,/g,'');
  if(!key)continue;if(key.length>2000||!/^\d+$/.test(raw||'')||!Number.isSafeInteger(Number(raw)))invalid('Invalid selector count in CSV');
  result.push({key,count:Number(raw)});
 }return result;
}
function pngSize(bytes){
 if(bytes.length<33||bytes.toString('hex',0,8)!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')invalid('Please select an original PNG heatmap export');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(width<100||width>10000||height<100||height>200000||width*height>200000000)invalid('PNG dimensions too large or invalid');return {width,height};
}
async function save(b,userId){
 if(!Number.isInteger(b.siteId)||b.siteId<1||!['desktop','mobile','tablet'].includes(b.device))invalid('Invalid heatmap cohort');
 cleanPath(b.path);monthBounds(b.month);
 if(typeof b.png!=='string'||b.png.length>14000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.png))invalid('PNG upload too large or invalid');
 const bytes=Buffer.from(b.png,'base64'),size=pngSize(bytes),selectorCounts=selectorsFromCsv(b.csv||'');
 for(const k of ['pageviews','clicks'])if(b[k]!==null&&b[k]!==undefined&&(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>2147483647))invalid('Invalid export totals');
 if(typeof b.name!=='string'||!b.name.trim()||b.name.length>255)invalid('Invalid export filename');
 const page=(await query('SELECT id FROM tracked_pages WHERE site_id=? AND page_path=? AND is_tracked=TRUE',[b.siteId,b.path]))[0];if(!page)invalid('Select a registered public page');
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const existing=await query('SELECT id FROM heatmap_archives WHERE site_id=? AND page_path=? AND device=? AND period_month=? AND sha256=?',[b.siteId,b.path,b.device,b.month,hash]);if(existing.length)return {id:existing[0].id,duplicate:true};
 const filename=`clarity-${hash}.png`;await writeAsset(filename,bytes);
 const r=await query('INSERT INTO heatmap_archives(site_id,page_path,device,period_month,viewport_width,document_height,image_path,pageviews,clicks,selector_counts,export_name,sha256,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[b.siteId,b.path,b.device,b.month,size.width,size.height,`/snapshots/${filename}`,b.pageviews??null,b.clicks??null,JSON.stringify(selectorCounts),b.name.trim(),hash,userId]);
 return {id:r.insertId,...size,selectors:selectorCounts.length,source:'clarity-file',metadata:'admin-declared'};
}
async function compare(o){
 cleanPath(o.path);monthBounds(o.monthA);monthBounds(o.monthB);
 if(!Number.isInteger(o.siteId)||o.siteId<1||!['desktop','mobile','tablet'].includes(o.device))invalid('Invalid archive cohort');
 const rows=await query('SELECT id,period_month,viewport_width,document_height,image_path,pageviews,clicks,selector_counts,export_name,created_at FROM heatmap_archives WHERE site_id=? AND page_path=? AND device=? AND period_month IN (?,?) ORDER BY id DESC',[o.siteId,o.path,o.device,o.monthA,o.monthB]);
 const latest=m=>{const r=rows.find(r=>r.period_month===m);if(!r)return null;return {...r,selector_counts:typeof r.selector_counts==='string'?JSON.parse(r.selector_counts):r.selector_counts};};
 return {a:latest(o.monthA),b:latest(o.monthB),source:'clarity-file',coordinateData:false,metadata:'admin-declared',warning:'Ảnh PNG giữ màu heatmap gốc. CSV đối chiếu theo selector; không suy ra tọa độ hoặc số lượt chạm từng ô từ ảnh. Nhãn tháng, URL, thiết bị và tổng lượt do người nhập xác nhận theo bộ lọc lúc xuất.'};
}
module.exports={csvRows,selectorsFromCsv,pngSize,save,compare};
