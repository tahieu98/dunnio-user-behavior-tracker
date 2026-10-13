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
 console.log(JSON.stringify({success:true,reopen:true,runtimeClean:true,dataRetained:true}));
 fs.rmSync(root,{recursive:true,force:true});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
