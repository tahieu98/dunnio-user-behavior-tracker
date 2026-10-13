'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {Runtime}=require('../runtime.cjs');
test('multiple quit requests share one shutdown and never start another runtime',async()=>{
 const runtime=new Runtime({root:'unused',resources:'unused'});let stops=0;
 runtime.shutdown=async()=>{stops++;await new Promise(r=>setTimeout(r,20));};
 const first=runtime.stop(),second=runtime.stop();assert.equal(first,second);await Promise.all([first,second,runtime.stop()]);assert.equal(stops,1);
});
test('worker environment isolates localhost, disables demo and removes host injection options',()=>{
 const before=process.env.NODE_OPTIONS;process.env.NODE_OPTIONS='--inspect=0.0.0.0';
 try{const runtime=new Runtime({root:'/data',resources:'/app'});runtime.settings=require('../security.cjs').defaults();runtime.run='/data/runtime/test';runtime.webPort=42001;runtime.dbPort=42002;runtime.base='http://127.0.0.1:42001';runtime.key='a'.repeat(64);const env=runtime.env();assert.equal(env.HOST,'127.0.0.1');assert.equal(env.ENABLE_DEMO,'false');assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.DESKTOP_IMPORT_ENV,'');assert.equal(env.PLAYWRIGHT_CHANNEL,'chromium');}
 finally{if(before===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=before;}
});
