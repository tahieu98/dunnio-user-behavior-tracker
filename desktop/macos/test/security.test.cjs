'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {defaults,trustedLocal,externalHttps,validateClarity,removeSession,saveSettings,loadSettings}=require('../security.cjs');
test('navigation permits only the exact local origin and HTTPS external links',()=>{
 const base='http://127.0.0.1:39123';assert.ok(trustedLocal(base+'/touch.html',base));
 for(const raw of ['http://127.0.0.1:1/touch.html','http://localhost:39123','file:///tmp/test','javascript:alert(1)',base+'@evil.test'])assert.ok(!trustedLocal(raw,base));
 assert.ok(externalHttps('https://clarity.microsoft.com/'));for(const raw of ['file:///tmp','javascript:1','http://example.com','https://token@example.com'])assert.ok(!externalHttps(raw));
});
test('cleanup can remove only one UUID session and preserves database/settings',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dunnio-security-')),session=path.join(root,'runtime',crypto.randomUUID());
 try{fs.mkdirSync(session,{recursive:true});fs.writeFileSync(path.join(root,'important'),'keep');removeSession(root,session);assert.ok(!fs.existsSync(session));assert.ok(fs.existsSync(path.join(root,'important')));for(const bad of [root,path.join(root,'data'),path.join(root,'runtime'),path.join(root,'runtime','old')])assert.throws(()=>removeSession(root,bad));}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('settings fail closed without Keychain and never write plaintext secrets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dunnio-keychain-')),key=crypto.randomBytes(32);
 const storage={isEncryptionAvailable:()=>true,encryptString:value=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([c.update(value),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]);},decryptString:buffer=>{const c=crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));c.setAuthTag(buffer.subarray(12,28));return Buffer.concat([c.update(buffer.subarray(28)),c.final()]).toString();}};
 try{const settings=defaults();settings.CLARITY_API_TOKEN='private-test-token';saveSettings(root,settings,storage);assert.ok(!fs.readFileSync(path.join(root,'settings.keychain')).includes(Buffer.from('private-test-token')));assert.deepEqual(loadSettings(root,storage),settings);assert.throws(()=>saveSettings(root,settings,{isEncryptionAvailable:()=>false}),/Keychain/);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Clarity credentials and startup secrets are validated/generated uniquely',()=>{assert.ok(validateClarity('vrgbdox3b7','x'.repeat(64)));assert.ok(!validateClarity('../bad','x'.repeat(64)));const a=defaults(),b=defaults();assert.equal(a.DB_PASSWORD.length,64);assert.notEqual(a.JWT_SECRET,b.JWT_SECRET);});
