'use strict';
require('dotenv').config({path:process.env.DOTENV_CONFIG_PATH||undefined});
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {query,pool}=require('../src/config/database'),store=require('../src/services/touchStore'),archive=require('../src/services/touchArchive');
test('real MySQL archive → empty target site → identical report; concurrent restore retry and conflicting live day',{skip:!process.env.RUN_DB_TESTS},async t=>{
 const suffix=crypto.randomBytes(5).toString('hex'),origin=`https://archive-${suffix}.example.test`,pagePath='/public-guide',directory=await fs.mkdtemp(path.join(os.tmpdir(),'dunnio-archive-db-'));let siteId,saved,precisionArchive;
 async function clear(id){for(const table of [...archive.TABLES,'touch_batches'])await query(`DELETE FROM ${table} WHERE site_id=?`,[id]);await query('DELETE FROM tracked_pages WHERE site_id=?',[id]);await query('DELETE FROM tracking_sites WHERE id=?',[id]);}
 t.after(async()=>{const rows=await query('SELECT id FROM tracking_sites WHERE origin=?',[origin]);for(const s of rows)await clear(s.id);for(const item of [saved,precisionArchive].filter(Boolean)){await query('DELETE FROM touch_archive_restores WHERE archive_id=?',[item.archiveId]);for(const f of [item.file,item.manifestFile])await fs.unlink(f).catch(()=>{});}await pool.end();});
 const key=crypto.randomUUID(),result=await query('INSERT INTO tracking_sites(name,origin,public_key,goal_paths,tracking_scope) VALUES (?,?,?,?,?)',['Archive QA',origin,key,'[]','all-public']);siteId=result.insertId;
 const site={id:siteId,public_key:key,tracking_scope:'all-public'},timestamp=Date.now(),date=new Date(timestamp+7*3600000).toISOString().slice(0,10);
 const body={schemaVersion:1,siteKey:key,batchId:crypto.randomUUID(),consent:true,sampleRate:1,context:{pagePath,layoutVersion:'qa-v1',device:'mobile',viewportWidth:390,viewportHeight:844,documentHeight:3000},entries:[{type:'pageview',timestamp,count:10},{type:'tap',timestamp,count:500,x:125,y:950,elementKey:'guide',region:'article',anchorQuality:'explicit',elementU:0.4,elementV:0.5,elementRect:{x:20,y:800,width:300,height:300},fixed:false,pointerType:'touch'}]};
 await store.ingest(site,body);const opts={siteId,path:pagePath,device:'mobile',version:'qa-v1',width:390,periods:[{id:'one',label:'Ngày QA',start:date,end:date,group:'A'}]};
 const before=await store.report(opts);saved=await archive.exportDay({date,directory,siteId});assert.equal(saved.rows.touch_daily_points,1);assert.ok(saved.compressedBytes<saved.uncompressedBytes);await archive.readArchive(saved.file);
 assert.deepEqual(Object.keys((await archive.readArchive(saved.file)).payload.sites[0]).sort(),['id','name','origin']);
 await assert.rejects(archive.restoreFile({file:saved.file}),/already has measurements/);assert.equal((await query('SELECT COUNT(*) n FROM touch_archive_restores WHERE archive_id=?',[saved.archiveId]))[0].n,0);
 await clear(siteId);const imported=await Promise.all([archive.restoreFile({file:saved.file}),archive.restoreFile({file:saved.file})]);assert.equal(imported.filter(x=>!x.duplicate).length,1);assert.equal(imported.filter(x=>x.duplicate).length,1);
 const targetId=(await query('SELECT id FROM tracking_sites WHERE origin=?',[origin]))[0].id;assert.notEqual(targetId,siteId);const after=await store.report({...opts,siteId:targetId});assert.deepEqual(after.periods[0].summary,before.periods[0].summary);assert.deepEqual(after.periods[0].cells,before.periods[0].cells);assert.deepEqual(after.periods[0].elements,before.periods[0].elements);
 assert.equal((await archive.restoreFile({file:saved.file})).duplicate,true);assert.equal((await store.report({...opts,siteId:targetId})).periods[0].summary.taps,500);
 // Preserve values above the JavaScript safe integer limit through actual SQL and gzip.
 const exact='9007199254740993';await query('UPDATE touch_daily_pages SET taps=? WHERE site_id=?',[exact,targetId]);
 await query('UPDATE touch_daily_points SET count=? WHERE site_id=?',[exact,targetId]);
 await query('UPDATE touch_daily_elements SET count=?,sum_x=CAST(? AS DECIMAL(30,0))*125,sum_y=CAST(? AS DECIMAL(30,0))*950 WHERE site_id=?',[exact,exact,exact,targetId]);
 precisionArchive=await archive.exportDay({date,directory,siteId:targetId});const precise=(await archive.readArchive(precisionArchive.file)).payload;
 assert.equal(precise.tables.touch_daily_pages[0].taps,exact);assert.equal(precise.tables.touch_daily_points[0].count,exact);assert.equal(precise.tables.touch_daily_elements[0].count,exact);
 await clear(targetId);await archive.restoreFile({file:precisionArchive.file});const latest=(await query('SELECT id FROM tracking_sites WHERE origin=?',[origin]))[0].id;
 assert.equal((await query('SELECT CAST(taps AS CHAR) taps FROM touch_daily_pages WHERE site_id=?',[latest]))[0].taps,exact);
});
