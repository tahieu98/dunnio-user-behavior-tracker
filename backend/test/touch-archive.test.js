'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const a=require('../src/services/touchArchive'),{pool}=require('../src/config/database');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test.after(()=>pool.end());
test('archive dates are real and yesterday follows UTC+07 around midnight',()=>{
 assert.throws(()=>a.calendar('2026-02-30'));assert.throws(()=>a.calendar('2026-13-01'));assert.equal(a.calendar('2024-02-29'),'2024-02-29');
 assert.equal(a.yesterday(new Date('2026-10-11T16:59:59Z')),'2026-10-10');assert.equal(a.yesterday(new Date('2026-10-11T17:00:00Z')),'2026-10-11');
});
test('archive gzip SHA256 validation, local copy and corruption rejection',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dunnio-touch-archive-')),file=path.join(dir,'fixture.json.gz');
 // Only individually created fixture files are removed; no recursive filesystem deletion.
 const paths=[];t.after(async()=>{for(const f of paths)await fs.unlink(f).catch(()=>{});});
 const p={schemaVersion:1,date:'2026-07-01',timezone:'Asia/Ho_Chi_Minh',source:'first-party-aggregated',sites:[],pages:[],snapshots:[],tables:{touch_daily_pages:[],touch_daily_points:[],touch_daily_elements:[]}};
 const raw=Buffer.from(JSON.stringify(p)),bytes=zlib.gzipSync(raw),m={schemaVersion:1,archiveId:sha(raw),payloadSha256:sha(raw),file:path.basename(file),sha256:sha(bytes),compressedBytes:bytes.length,uncompressedBytes:raw.length};
 await fs.writeFile(file,bytes);await fs.writeFile(file+'.manifest.json',JSON.stringify(m));paths.push(file,file+'.manifest.json');
 assert.deepEqual((await a.readArchive(file)).payload,p);
 const dest=path.join(dir,'copy'),copied=await a.copyArchive({file,destination:dest});paths.push(copied.file,copied.file+'.manifest.json');assert.deepEqual((await a.readArchive(copied.file)).payload,p);
 const bad=Buffer.from(bytes);bad[bad.length-1]^=1;await fs.writeFile(file,bad);await assert.rejects(a.readArchive(file),/checksum/);
});
test('archive excludes unexpected tables, private paths and mismatched snapshot content',()=>{
 const p={schemaVersion:1,date:'2026-07-01',timezone:'Asia/Ho_Chi_Minh',source:'first-party-aggregated',sites:[{id:1,name:'Fixture',origin:'https://fixture.test'}],pages:[],snapshots:[],tables:{touch_daily_pages:[],touch_daily_points:[],touch_daily_elements:[]}};
 a.validatePayload(p);assert.throws(()=>a.validatePayload({...p,tables:{...p.tables,users:[]}}));
 assert.throws(()=>a.validatePayload({...p,pages:[{site_id:1,page_path:'/account/name',title:'Private',category:'x'}]}));
 assert.throws(()=>a.validatePayload({...p,snapshots:[{site_id:1,page_path:'/public',image_path:'/snapshots/../secret.png',image_base64:'',image_sha256:''}]}));
});
test('semantic archive validation rejects forged hashes, bad bins, zero points, inconsistent counts and unsafe numeric rounding',()=>{
 const math=require('../src/services/touchMath'),store=require('../src/services/touchStore'),timestamp=Date.now(),data=store.aggregate(math.validateBatch({schemaVersion:1,siteKey:'fixture',batchId:crypto.randomUUID(),consent:true,sampleRate:1,context:{pagePath:'/guide',layoutVersion:'fixture',device:'mobile',viewportWidth:390,viewportHeight:844,documentHeight:2000},entries:[{type:'pageview',timestamp,count:1},{type:'tap',timestamp,count:1,x:100,y:500,elementKey:'guide',region:'article',anchorQuality:'explicit',elementU:.5,elementV:.5,elementRect:{x:50,y:450,width:100,height:100},fixed:false,pointerType:'touch'}]}));
 const p={schemaVersion:1,date:math.eventDate(timestamp),timezone:'Asia/Ho_Chi_Minh',source:'first-party-aggregated',sites:[{id:1,name:'Fixture',origin:'https://fixture.test'}],pages:[{site_id:1,page_path:'/guide',title:'Guide',category:'other',is_tracked:1}],snapshots:[],tables:Object.fromEntries([['touch_daily_pages',data.pages],['touch_daily_points',data.points],['touch_daily_elements',data.elements]].map(([t,rows])=>[t,rows.map(r=>({site_id:1,...r}))]))};
 a.validatePayload(p);for(const mutate of [x=>x.tables.touch_daily_pages[0].taps=999,x=>x.tables.touch_daily_elements[0].count=0,x=>x.tables.touch_daily_points[0].dimension_hash='f'.repeat(64),x=>x.tables.touch_daily_points[0].grid_col=255,x=>x.pages=[]]){const bad=structuredClone(p);mutate(bad);assert.throws(()=>a.validatePayload(bad));}
 const exact='9007199254740993',big=structuredClone(p);big.tables.touch_daily_pages[0].taps=exact;big.tables.touch_daily_points[0].count=exact;big.tables.touch_daily_elements[0].count=exact;a.validatePayload(big);
 const unsafe=structuredClone(big);unsafe.tables.touch_daily_pages[0].taps=Number(exact);assert.throws(()=>a.validatePayload(unsafe),/count/);
});
