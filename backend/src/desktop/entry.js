'use strict';
// Spawned only by the native controller. Credentials arrive through its private process environment.
process.env.DUNNIO_DESKTOP_MODE='true';
const {record}=require('./diagnostics');
process.on('uncaughtExceptionMonitor',record);
const {startServer}=require('../server');const {pool}=require('../config/database');
const mysql=require('mysql2/promise');const fs=require('fs'),path=require('path');
let server,stopping=false;
async function stop(){
 if(stopping)return;stopping=true;
 const emergency=setTimeout(()=>process.exit(2),25000);emergency.unref();
 try{
  await require('../services/snapshotCapture').cancel();
  if(server){await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections?.();setTimeout(()=>server.closeAllConnections?.(),4000).unref();});}
  await pool.end();
  const root=await mysql.createConnection({host:'127.0.0.1',port:Number(process.env.DB_PORT),user:'root',password:process.env.DESKTOP_MYSQL_ROOT_PASSWORD,connectTimeout:3000});
  try{await root.query('SHUTDOWN');}finally{await root.end().catch(()=>{});}
  process.exitCode=0;
 }catch(e){console.error('Desktop shutdown:',e.code||e.message);process.exitCode=2;}
 finally{clearTimeout(emergency);process.exit(process.exitCode||0);}
}
require('./control').setShutdownHandler(stop);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void stop());
startServer().then(s=>{
 server=s;
 const state={instance:process.env.DESKTOP_INSTANCE_ID,pid:process.pid,port:Number(process.env.PORT),dbPort:Number(process.env.DB_PORT),dataRoot:process.env.DESKTOP_DATA_ROOT};
 fs.writeFileSync(path.join(process.env.DESKTOP_RUN_ROOT,'state.json'),JSON.stringify(state));
}).catch(e=>{record(e,'startup');console.error('Desktop start failed:',e.message);process.exit(1);});
