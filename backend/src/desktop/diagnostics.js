'use strict';
const fs=require('fs'),path=require('path');
function record(error,origin){
 if(!process.env.DESKTOP_DATA_ROOT)return;
 // Exclude message, payload and full stack, which may contain credentials.
 const identifier=value=>/^[A-Za-z0-9_.-]{1,80}$/.test(value||'')?value:'unknown';
 const frames=String(error?.stack||'').split('\n').slice(1,9).map(line=>{
  const match=line.match(/[\\/]([^\\/():]+\.js):(\d+):(\d+)\)?$/);
  return match?{file:match[1],line:Number(match[2]),column:Number(match[3])}:null;
 }).filter(Boolean);
 try{fs.writeFileSync(path.join(process.env.DESKTOP_DATA_ROOT,'last-backend-error.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,origin:identifier(origin),type:identifier(error?.name),code:identifier(error?.code),frames},null,2));}catch{}
}
module.exports={record};
