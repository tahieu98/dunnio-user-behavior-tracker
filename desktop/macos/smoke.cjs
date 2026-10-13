'use strict';
const {spawn}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const exe=process.argv[2];if(process.platform!=='darwin'||!exe)throw new Error('Pass the packaged .app/Contents/MacOS/Dunnio Insights executable on macOS.');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dunnio-mac-smoke-'));
 for(let cycle=0;cycle<2;cycle++)await new Promise((resolve,reject)=>{
  const child=spawn(exe,['--smoke-test','--test-data-dir='+root],{stdio:'inherit'});
  const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Mac smoke timed out'));},180000);
  child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Mac smoke exited '+code));});
 });
 assert.equal(fs.readdirSync(path.join(root,'runtime')).length,0);assert.ok(fs.existsSync(path.join(root,'data/mysql/auto.cnf')));
 // Force quit the launcher: its detached IPC guardian must still stop MySQL,
 // Node and any descendants, and remove only its own session.
 const held=spawn(exe,['--smoke-test','--smoke-hold','--test-data-dir='+root],{stdio:'ignore'});
 const pause=ms=>new Promise(r=>setTimeout(r,ms));let owner,run;
 for(let attempt=0;attempt<600;attempt++){for(const folder of fs.readdirSync(path.join(root,'runtime'))){const candidate=path.join(root,'runtime',folder,'owner.json');if(fs.existsSync(candidate)){owner=JSON.parse(fs.readFileSync(candidate,'utf8'));run=path.dirname(candidate);break;}}if(owner)break;if(held.exitCode!==null)throw new Error('Guardian test exited early');await pause(100);}
 assert.ok(owner,'Guardian test did not become ready');held.kill('SIGKILL');
 const exists=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
 for(let attempt=0;attempt<450&&(exists(owner.workerPid)||exists(owner.backendPid)||exists(owner.mysqlPid)||fs.existsSync(run));attempt++)await pause(100);
 for(const pid of [owner.workerPid,owner.backendPid,owner.mysqlPid])assert.ok(!exists(pid),'Owned process survived force quit');assert.ok(!fs.existsSync(run),'Force quit left session cache');
 console.log(JSON.stringify({success:true,reopen:true,runtimeClean:true,dataRetained:true,forceQuitStopsGuardianAndChildren:true}));
 fs.rmSync(root,{recursive:true,force:true});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
