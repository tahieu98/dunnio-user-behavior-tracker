'use strict';
const {Runtime}=require('./runtime.cjs');let runtime,closing=false;
const send=message=>{if(process.connected)process.send(message);};
function terminateGroup(){try{process.kill(-process.pid,'SIGKILL');}catch{process.exit(0);}}
async function close(){if(closing)return;closing=true;try{await runtime?.stop();}finally{if(process.connected){send({type:'stopped'});setTimeout(terminateGroup,5000);}else{try{require('./security.cjs').removeSession(runtime.root,runtime.run);}catch{}terminateGroup();}}}
process.on('disconnect',()=>void close());for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>void close());
process.on('message',async message=>{
 try{
  if(message.type==='start'){runtime=new Runtime({...message.options,notify:message=>{if(message.type!=='stopped')send(message);}});const state=await runtime.start(message.settings);send({type:'ready',...state});}
  else if(message.type==='call'){const value=await runtime.call(message.endpoint,message.data);send({type:'result',id:message.id,value});}
  else if(message.type==='stop')await close();
 }catch(error){if(message.type==='call')send({type:'result',id:message.id,error:'Local request failed'});else{send({type:'failure',code:error.code||'START_FAILED'});await close();}}
});
