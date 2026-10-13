'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const secret=()=>crypto.randomBytes(32).toString('hex');
function defaults(){return {DB_PASSWORD:secret(),MYSQL_ROOT_PASSWORD:secret(),JWT_SECRET:secret(),INITIAL_ADMIN_PASSWORD:secret(),CLARITY_API_TOKEN:'',CLARITY_PROJECT_ID:'',CLARITY_PROJECT_NAME:'Dunnio Tailor',initialized:false};}
function saveSettings(root,settings,storage){
 if(!storage.isEncryptionAvailable())throw new Error('Không truy cập được Keychain. Mở khóa Keychain trước khi sử dụng.');
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 const file=path.join(root,'settings.keychain'),temporary=file+'.'+crypto.randomUUID()+'.partial';
 try{fs.writeFileSync(temporary,storage.encryptString(JSON.stringify(settings)),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function loadSettings(root,storage){
 if(!storage.isEncryptionAvailable())throw new Error('Không truy cập được Keychain.');
 const file=path.join(root,'settings.keychain');
 if(fs.existsSync(file))return JSON.parse(storage.decryptString(fs.readFileSync(file)));
 const settings=defaults();saveSettings(root,settings,storage);return settings;
}
function trustedLocal(raw,base){try{const url=new URL(raw);return url.origin===new URL(base).origin&&!url.username&&!url.password;}catch{return false;}}
function externalHttps(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function validateClarity(projectId,token){return typeof projectId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(projectId)&&typeof token==='string'&&token.length>=30&&token.length<=8192;}
function removeSession(root,session){
 const parent=path.resolve(root,'runtime'),target=path.resolve(session);
 if(path.dirname(target)!==parent||! /^[a-f0-9-]{36}$/.test(path.basename(target)))throw new Error('Refusing cleanup outside the session directory');
 if(fs.existsSync(parent)&&fs.lstatSync(parent).isSymbolicLink())throw new Error('Runtime directory cannot be a symlink');
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw new Error('Session directory cannot be a symlink');
 fs.rmSync(target,{recursive:true,force:true});
}
module.exports={defaults,loadSettings,saveSettings,trustedLocal,externalHttps,validateClarity,removeSession,secret};
