'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process'),{pipeline}=require('node:stream/promises'),{Readable}=require('node:stream');
const root=path.resolve(__dirname,'../..'),stage=path.join(root,'.local/macos-build'),lock=require('./vendor-lock.json');
function run(exe,args,cwd=root,env=process.env){const r=spawnSync(exe,args,{cwd,env,stdio:'inherit'});if(r.error||r.status!==0)throw new Error(exe+' failed');}
function copy(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(source,target,{recursive:true,dereference:false});}
async function prepare(){
 if(process.platform!=='darwin')throw new Error('Build macOS chạy trên macOS hoặc GitHub Actions macOS runner.');
 const arch=process.arch;if(!lock.mysql[arch])throw new Error('Unsupported Mac architecture');
 fs.mkdirSync(stage,{recursive:true});
 const tarball=path.join(stage,'mysql-'+arch+'.tar.gz'),vendor=path.join(stage,'vendor'),payload=path.join(stage,'payload');
 if(!fs.existsSync(tarball)){const response=await fetch(lock.mysql[arch].url);if(!response.ok)throw new Error('MySQL download HTTP '+response.status);await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(tarball,{flags:'wx'}));}
 const checksum=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(tarball))checksum.update(chunk);if(checksum.digest('hex')!==lock.mysql[arch].sha256)throw new Error('MySQL SHA-256 mismatch');
 fs.mkdirSync(path.join(vendor,'mysql'),{recursive:true});run('tar',['-xzf',tarball,'--strip-components=1','-C',path.join(vendor,'mysql')]);
 // Preserve Oracle's complete library/share tree for relocatable binaries.
 for(const folder of ['src','migrations','scripts'])copy(path.join(root,'backend',folder),path.join(payload,'backend',folder));
 for(const file of ['package.json','package-lock.json'])copy(path.join(root,'backend',file),path.join(payload,'backend',file));
 run('npm',['ci','--omit=dev','--ignore-scripts','--no-fund'],path.join(payload,'backend'));
 for(const folder of ['frontend','tracker']){
  fs.cpSync(path.join(root,folder),path.join(payload,folder),{recursive:true,filter:source=>!source.includes(path.sep+'snapshots'+path.sep)&&!source.includes(path.sep+'touch-archives'+path.sep)});
 }
 run(process.execPath,[path.join(payload,'backend/node_modules/playwright-core/cli.js'),'install','chromium'],path.join(payload,'backend'),{...process.env,PLAYWRIGHT_BROWSERS_PATH:path.join(vendor,'browsers')});
 const licenses=path.join(stage,'licenses');fs.mkdirSync(licenses,{recursive:true});
 for(const file of ['LICENSE','README'])if(fs.existsSync(path.join(vendor,'mysql',file)))copy(path.join(vendor,'mysql',file),path.join(licenses,'MYSQL-'+file+'.txt'));
 copy(path.join(__dirname,'THIRD-PARTY-NOTICES.md'),path.join(licenses,'THIRD-PARTY-NOTICES.md'));
 copy(path.join(root,'LICENSE'),path.join(licenses,'DUNNIO-LICENSE.txt'));
 fs.writeFileSync(path.join(licenses,'runtime-manifest.json'),JSON.stringify({version:require('./package.json').version,arch,mysql:lock.mysqlVersion,mysqlSha256:lock.mysql[arch].sha256,electron:require('./package.json').devDependencies.electron,playwright:require(path.join(payload,'backend/node_modules/playwright-core/package.json')).version,containsUserData:false},null,2));
 console.log('macOS payload prepared: '+arch);
}
prepare().catch(e=>{console.error(e.message);process.exitCode=1;});
