// Read-only synthetic fixtures, never written into measured analytics.
const {summarize,compare}=require('./behaviorMath');
const PATH='/blog/what-suit-color-to-choose.html';
const fs=require('fs'),path=require('path');
function metadata(device) {
 const file=path.join(__dirname,'../../../frontend/snapshots',`dunnio-${device}.json`);
 if(fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));
 return {viewport_width:device==='mobile'?390:1440,document_height:7000,image_path:null};
}
function fixture(device='desktop') {
 const m=metadata(device),events=[];
 for(const [month,views,clicks] of [['2026-08',29,10],['2026-09',32,17]]) {
  const points=device==='mobile'?[[6,8,'toc'],[6,30,'navy-cta'],[4,52,'accordion'],[6,80,'related-posts']]:[[4,10,'toc'],[5,34,'navy-cta'],[7,61,'accordion'],[11,15,'related-posts']];
  for(let i=0;i<views;i++)events.push({event_id:`v-${month}-${i}`,event_type:'pageview',view_id:`view-${month}-${i}`,session_hash:`s-${month}-${i}`,occurred_at:`${month}-${String(1+i%28).padStart(2,'0')}T08:00:00Z`,device,layout_version:'dunnio-2026-10',viewport_width:m.viewport_width});
  for(let i=0;i<clicks;i++) {
   const point=points[(i+(month.endsWith('09')?1:0))%points.length],view=events.find(e=>e.event_id===`v-${month}-${i}`);
   const c={...view,event_id:`c-${month}-${i}`,event_type:'click',grid_col:point[0],grid_row:point[1],region_key:point[2],element_key:point[2]};events.push(c);
   if(i%3===0)events.push({...c,event_id:`a-${month}-${i}`,event_type:'action',source_event_id:c.event_id,action_name:'navigation',target_path:'/men/custom-suits'});
   events.push({...c,event_id:`e-${month}-${i}`,event_type:'exposure'});
  }
 }
 return events;
}
function catalog() {
 const snapshots=['desktop','mobile'].map(device=>({site_id:1,page_path:PATH,device,layout_version:'dunnio-2026-10',...metadata(device)}));
 return {sites:[{id:1,name:'Dunnio Tailor',origin:'https://dunniotailor.com',public_key:'dunnio-public-v1',goal_paths:['/men/custom-suits','/3d-custom-outfit/suits.html']}],pages:[{id:1,title:'What suit color to choose',url_path:PATH,url:`https://dunniotailor.com${PATH}`,category:'blog'}],snapshots,layouts:snapshots,source:'demo',timezone:'Asia/Ho_Chi_Minh'};
}
function report(o) {
 const events=fixture(o.device),m=metadata(o.device);
 const a=summarize(events,o.monthA,o.device,'dunnio-2026-10',m.viewport_width),b=summarize(events,o.monthB,o.device,'dunnio-2026-10',m.viewport_width);
 const snapshot={...m,device:o.device,layout_version:'dunnio-2026-10',captured_at:'2026-10-07'};
 return {a,b,deltas:compare(a,b),snapshot,snapshots:{a:snapshot,b:snapshot},comparableGeometry:true,source:'demo',timezone:'Asia/Ho_Chi_Minh',attribution:'Synthetic data for preview only'};
}
module.exports={catalog,report};
