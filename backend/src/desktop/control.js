'use strict';
const crypto=require('crypto'),path=require('path'),fs=require('fs'),zlib=require('zlib');
const {pipeline}=require('stream/promises');const {spawn}=require('child_process');
const User=require('../models/User');const {generateToken}=require('../middleware/auth');
const {asyncHandler}=require('../middleware/errorHandler');
const {query}=require('../config/database');
const tickets=new Map();let shutdownHandler=null;
function sameSecret(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&x.length>=32&&crypto.timingSafeEqual(x,y);}
function local(req){return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);}
function guard(req,res,next){
 if(!local(req)||!sameSecret(req.headers['x-dunnio-control'],process.env.DESKTOP_CONTROL_KEY))return res.status(403).json({success:false,message:'Local controller required'});
 if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${process.env.PORT}`)return res.status(403).json({success:false,message:'Origin rejected'});
 next();
}
async function backup(){
 const dir=path.resolve(process.env.DESKTOP_DATA_ROOT,'backups');await fs.promises.mkdir(dir,{recursive:true});
 const file=path.join(dir,`dunnio-${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(3).toString('hex')}.sql.gz`);
 const temporary=path.join(process.env.DESKTOP_RUN_ROOT,path.basename(file)+'.partial');
 const child=spawn(process.env.DESKTOP_MYSQLDUMP,['--no-defaults','--host=127.0.0.1',`--port=${process.env.DB_PORT}`,`--user=${process.env.DB_USER}`,'--single-transaction','--no-tablespaces','--set-gtid-purged=OFF','--skip-comments','--default-character-set=utf8mb4',process.env.DB_NAME],{windowsHide:true,env:{...process.env,MYSQL_PWD:process.env.DB_PASSWORD},stdio:['ignore','pipe','pipe']});
 let error='';child.stderr.on('data',b=>{if(error.length<2000)error+=b.toString();});
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('Database backup failed')));});
 try{await Promise.all([pipeline(child.stdout,zlib.createGzip(),fs.createWriteStream(temporary,{flags:'wx'})),done]);await fs.promises.rename(temporary,file);return file;}
 catch(e){child.kill();await fs.promises.unlink(temporary).catch(()=>{});throw e;}
}
function attach(app){
 if(!/^[a-f0-9]{64}$/.test(process.env.DESKTOP_CONTROL_KEY||''))throw new Error('Invalid desktop controller key');
 app.get('/api/desktop/status',guard,asyncHandler(async(req,res)=>{
  const counts={};for(const table of ['users','tracked_pages','behavior_events','clarity_exports','page_snapshots'])counts[table]=(await query(`SELECT COUNT(*) count FROM ${table}`))[0].count;
  res.json({success:true,data:{instance:process.env.DESKTOP_INSTANCE_ID,pid:process.pid,version:require('../../package.json').version,admin:process.env.DESKTOP_ADMIN_USERNAME||'admin',clarityConfigured:!!process.env.CLARITY_API_TOKEN,counts}});
 }));
 app.post('/api/desktop/ticket',guard,(req,res)=>{
  for(const [key,exp] of tickets)if(exp<Date.now())tickets.delete(key);
  while(tickets.size>=8)tickets.delete(tickets.keys().next().value);
  const ticket=crypto.randomBytes(32).toString('hex');tickets.set(ticket,Date.now()+30000);
  res.json({success:true,data:{url:`http://127.0.0.1:${process.env.PORT}/desktop-login.html#${ticket}`}});
 });
 app.post('/api/desktop/session',asyncHandler(async(req,res)=>{
  if(!local(req))return res.status(403).json({success:false,message:'Local session required'});
  if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${process.env.PORT}`)return res.status(403).json({success:false,message:'Origin rejected'});
  const ticket=typeof req.body.ticket==='string'?req.body.ticket:'';const expiry=tickets.get(ticket);tickets.delete(ticket);
  if(!expiry||expiry<Date.now())return res.status(403).json({success:false,message:'Ticket expired or consumed'});
  const user=await User.findByUsername(process.env.DESKTOP_ADMIN_USERNAME||'admin');
  if(!user||!user.is_active||user.role!=='admin')return res.status(403).json({success:false,message:'Local Admin unavailable'});
  res.json({success:true,data:{token:generateToken(user),user:{id:user.id,username:user.username,email:user.email,role:user.role}}});
 }));
 app.post('/api/desktop/backup',guard,asyncHandler(async(req,res)=>res.json({success:true,data:{file:await backup()}})));
 app.post('/api/desktop/clarity',guard,(req,res)=>{
  const {token,projectId}=req.body;
  if(typeof token!=='string'||token.length>8192||token.length<30||typeof projectId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(projectId))return res.status(400).json({success:false,message:'Invalid Clarity configuration'});
  process.env.CLARITY_API_TOKEN=token;process.env.CLARITY_PROJECT_ID=projectId;res.json({success:true});
 });
 app.post('/api/desktop/shutdown',guard,(req,res)=>{res.json({success:true});setTimeout(()=>shutdownHandler?.(),100).unref();});
}
module.exports={attach,setShutdownHandler:fn=>{shutdownHandler=fn;}};
