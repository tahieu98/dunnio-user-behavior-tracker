'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const {removeSession}=require('./security.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const s=net.createServer();await new Promise((r,j)=>s.once('error',j).listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
class Runtime {
 constructor({root,resources,instance=crypto.randomUUID(),execPath=process.execPath,notify=()=>{}}){this.root=root;this.resources=resources;this.instance=instance;this.execPath=execPath;this.notify=notify;this.children=new Map();this.settings=null;this.stopping=null;this.running=false;}
 launch(exe,args,env){
  if(this.stopping)throw new Error('Ứng dụng đang đóng');
  const child=spawn(exe,args,{env,cwd:this.resources,detached:false,stdio:'ignore'});
  this.children.set(child,{pid:child.pid,done:false,error:null});
  const state=this.children.get(child);child.once('error',e=>{state.error=e;state.done=true;});child.once('exit',()=>{state.done=true;});
  if(child.pid)this.notify({type:'child',pid:child.pid});return child;
 }
 async wait(child,timeout=90000){const state=this.children.get(child);const end=Date.now()+timeout;while(!state.done&&Date.now()<end)await delay(100);if(!state.done)throw new Error('Quá thời gian chuẩn bị dịch vụ');if(state.error||child.exitCode!==0)throw new Error('Dịch vụ không khởi động được (exit '+child.exitCode+')');}
 env(){
  const s=this.settings,mysql=path.join(this.resources,'vendor/mysql');
  const env={...process.env};for(const key of ['DOTENV_CONFIG_PATH','NODE_OPTIONS','NODE_PATH','MYSQL_PWD','RUN_DB_TESTS','TEST_BASE_URL'])delete env[key];
  return {...env,HOST:'127.0.0.1',PORT:String(this.webPort),NODE_ENV:'production',ENABLE_DEMO:'false',DB_HOST:'127.0.0.1',DB_PORT:String(this.dbPort),DB_NAME:'dunnio_insights',DB_USER:'dunnio_local',DB_PASSWORD:s.DB_PASSWORD,JWT_SECRET:s.JWT_SECRET,JWT_EXPIRES_IN:'2h',INITIAL_ADMIN_PASSWORD:s.INITIAL_ADMIN_PASSWORD,CORS_ORIGIN:this.base,DUNNIO_DESKTOP_MODE:'true',DESKTOP_CONTROL_KEY:this.key,DESKTOP_INSTANCE_ID:this.instance,DESKTOP_ADMIN_USERNAME:'admin',DESKTOP_DATA_ROOT:this.root,DESKTOP_RUN_ROOT:this.run,DESKTOP_MYSQL_ROOT_PASSWORD:s.MYSQL_ROOT_PASSWORD,DESKTOP_MYSQLDUMP:path.join(mysql,'bin/mysqldump'),DESKTOP_MYSQL_CLIENT:path.join(mysql,'bin/mysql'),DESKTOP_INITIAL_SETUP:s.initialized?'false':'true',DESKTOP_IMPORT_ENV:'',TEMP:this.run,TMP:this.run,TMPDIR:this.run,TOUCH_ARCHIVE_DIR:path.join(this.root,'touch-archives'),PLAYWRIGHT_BROWSERS_PATH:path.join(this.resources,'vendor/browsers'),PLAYWRIGHT_CHANNEL:'chromium'};
 }
 async start(settings){
  this.settings=settings;this.run=path.join(this.root,'runtime',this.instance);this.key=crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.join(this.root,'runtime'),{recursive:true,mode:0o700});
  if(fs.lstatSync(path.join(this.root,'runtime')).isSymbolicLink())throw new Error('Runtime directory cannot be a symlink');
  for(const item of fs.readdirSync(path.join(this.root,'runtime'))){if(item!==this.instance&&/^[a-f0-9-]{36}$/.test(item))removeSession(this.root,path.join(this.root,'runtime',item));}
  fs.mkdirSync(this.run,{mode:0o700,recursive:true});this.socketRoot=fs.mkdtempSync('/tmp/dunnio-');fs.chmodSync(this.socketRoot,0o700);this.webPort=await freePort();do{this.dbPort=await freePort();}while(this.dbPort===this.webPort);this.base='http://127.0.0.1:'+this.webPort;
  const env=this.env(),mysql=path.join(this.resources,'vendor/mysql'),data=path.join(this.root,'data/mysql');fs.mkdirSync(data,{recursive:true,mode:0o700});
  try{
   this.notify({type:'status',text:'Đang chuẩn bị kho dữ liệu…'});
   if(!fs.existsSync(path.join(data,'auto.cnf')))await this.wait(this.launch(path.join(mysql,'bin/mysqld'),['--no-defaults','--initialize-insecure','--basedir='+mysql,'--datadir='+data,'--log-error='+path.join(this.run,'mysql-init.log')],env));
   this.database=this.launch(path.join(mysql,'bin/mysqld'),['--no-defaults','--basedir='+mysql,'--datadir='+data,'--port='+this.dbPort,'--bind-address=127.0.0.1','--mysqlx=OFF','--skip-log-bin','--socket='+path.join(this.socketRoot,'mysql.sock'),'--pid-file='+path.join(this.run,'mysql.pid'),'--innodb-buffer-pool-size=64M','--performance-schema=OFF','--max-connections=30','--log-error='+path.join(this.run,'mysql.log')],env);
   let ready=false;for(let i=0;i<300;i++){if(this.children.get(this.database).done)throw new Error('MySQL đã thoát khi mở');try{await new Promise((r,j)=>{const socket=net.connect(this.dbPort,'127.0.0.1');socket.setTimeout(300);socket.once('connect',()=>{socket.destroy();r();});socket.once('error',j);socket.once('timeout',()=>{socket.destroy();j(new Error('timeout'));});});ready=true;break;}catch{await delay(100);}}
   if(!ready)throw new Error('Kho dữ liệu chưa sẵn sàng');
   const nodeEnv={...env,ELECTRON_RUN_AS_NODE:'1'};
   await this.wait(this.launch(this.execPath,[path.join(this.resources,'app/backend/src/desktop/setup.js')],nodeEnv));
   this.notify({type:'initialized'});
   this.backend=this.launch(this.execPath,[path.join(this.resources,'app/backend/src/desktop/entry.js')],nodeEnv);
   ready=false;for(let i=0;i<250;i++){if(this.children.get(this.backend).done)throw new Error('Backend không khởi động được');try{const status=await this.call('status');if(status.instance===this.instance){ready=true;break;}}catch{}await delay(100);}
   if(!ready)throw new Error('Backend chưa sẵn sàng');this.running=true;
   fs.writeFileSync(path.join(this.run,'owner.json'),JSON.stringify({instance:this.instance,workerPid:process.pid,backendPid:this.backend.pid,mysqlPid:this.database.pid}),{mode:0o600});
   this.monitor=setInterval(()=>{if(this.running&&!this.stopping&&[this.backend,this.database].some(c=>this.children.get(c).done)){this.notify({type:'service-error',code:'SERVICE_EXIT'});void this.stop();}},1000);this.monitor.unref();
   return {base:this.base,run:this.run};
  }catch(error){await this.stop();throw error;}
 }
 async call(endpoint,data){
  if(!this.base)throw new Error('Chưa bật dịch vụ');
  const response=await fetch(this.base+'/api/desktop/'+endpoint,{method:data===undefined?'GET':'POST',headers:{'X-Dunnio-Control':this.key,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(endpoint==='backup'?120000:5000)});
  const json=await response.json();if(!response.ok||!json.success)throw new Error('Yêu cầu local chưa hoàn tất');return json.data;
 }
 stop(){if(!this.stopping)this.stopping=this.shutdown();return this.stopping;}
 async shutdown(){
  clearInterval(this.monitor);this.running=false;
  this.notify({type:'status',text:'Đang đóng dịch vụ và dọn cache…'});
  try{if(this.backend&&!this.children.get(this.backend).done)await this.call('shutdown',{});
   else if(this.database&&!this.children.get(this.database).done){const p=spawn(path.join(this.resources,'vendor/mysql/bin/mysqladmin'),['--no-defaults','--host=127.0.0.1','--port='+this.dbPort,'--user=root','shutdown'],{env:{...this.env(),MYSQL_PWD:this.settings.MYSQL_ROOT_PASSWORD},stdio:'ignore'});await Promise.race([new Promise(r=>{p.once('exit',r);p.once('error',r);}),delay(10000)]);if(p.exitCode===null)p.kill('SIGKILL');}
  }catch{}
  const deadline=Date.now()+30000;while([...this.children.values()].some(s=>!s.done)&&Date.now()<deadline)await delay(100);
  // The worker owns one dedicated POSIX group, including headless Chromium.
  // Signal live child handles here; the guardian terminates its entire group.
  for(const [child,s] of this.children){if(!s.done)child.kill('SIGTERM');}
  await delay(300);for(const [child,s] of this.children){if(!s.done)child.kill('SIGKILL');}
  await delay(300);if(this.socketRoot)fs.rmSync(this.socketRoot,{recursive:true,force:true});this.notify({type:'stopped'});
 }
}
module.exports={Runtime,freePort};
