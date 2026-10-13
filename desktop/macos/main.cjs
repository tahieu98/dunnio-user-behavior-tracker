'use strict';
const {app,BrowserWindow,Menu,dialog,shell,ipcMain,safeStorage}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{fork}=require('node:child_process');
const security=require('./security.cjs');
const smoke=process.argv.includes('--smoke-test');
const testArg=process.argv.find(a=>a.startsWith('--test-data-dir='));
if(smoke&&!testArg)throw new Error('Smoke test requires an isolated --test-data-dir.');
const root=smoke&&testArg?path.resolve(testArg.slice('--test-data-dir='.length)):path.join(os.homedir(),'Library/Application Support/Dunnio Insights');
const instance=crypto.randomUUID(),run=path.join(root,'runtime',instance);
fs.mkdirSync(run,{recursive:true,mode:0o700});
for(const name of ['browser','crash-dumps','logs'])fs.mkdirSync(path.join(run,name),{mode:0o700});
app.setPath('userData',root);app.setPath('sessionData',path.join(run,'browser'));app.setPath('crashDumps',path.join(run,'crash-dumps'));app.setAppLogsPath(path.join(run,'logs'));app.setName('Dunnio Insights');
let window,configuration,worker,settings,base,ready=false,quitting=false,shutdownPromise,workerStopped,stopResolve;
const pending=new Map();let sequence=0;
if(!app.requestSingleInstanceLock()){security.removeSession(root,run);app.exit(0);}
else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.on('activate',()=>{if(window&&!quitting){window.show();window.focus();}});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',event=>{if(!quitting){event.preventDefault();void shutdown().finally(()=>app.exit(0));}});
 app.whenReady().then(start).catch(error=>{void fail(error);});
}
function request(endpoint,data){return new Promise((resolve,reject)=>{
 if(!worker?.connected)return reject(new Error('Dịch vụ đã dừng'));
 const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(new Error('Yêu cầu đã quá thời gian'));},endpoint==='backup'?125000:10000);
 pending.set(id,{resolve,reject,timer});worker.send({type:'call',id,endpoint,data});
});}
async function start(){
 if(process.platform!=='darwin')throw new Error('Gói này chỉ chạy trên macOS.');
 if(smoke){const file=path.join(root,'smoke-settings.json');settings=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):security.defaults();fs.writeFileSync(file,JSON.stringify(settings),{mode:0o600});}
 else settings=security.loadSettings(root,safeStorage);
 if(!smoke){window=new BrowserWindow({width:1440,height:950,minWidth:820,minHeight:600,title:'Dunnio Insights · macOS',backgroundColor:'#111e31',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,partition:'dunnio-'+instance}});window.setMenuBarVisibility(false);}
 const resources=app.isPackaged?process.resourcesPath:path.resolve(__dirname,'../../.local/macos-build');
 workerStopped=new Promise(resolve=>{stopResolve=resolve;});
 worker=fork(path.join(__dirname,'worker.cjs'),[],{execPath:process.execPath,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},detached:true,stdio:['ignore','ignore','ignore','ipc']});
 let resolveReady,rejectReady;const boot=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 worker.on('message',message=>{
  if(message.type==='initialized'){settings.initialized=true;if(!smoke)security.saveSettings(root,settings,safeStorage);}
  else if(message.type==='ready'){base=message.base;ready=true;resolveReady();}
  else if(message.type==='result'){const item=pending.get(message.id);if(item){clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(new Error(message.error)):item.resolve(message.value);}}
  else if(message.type==='failure'){rejectReady(new Error('Không mở được dịch vụ ('+message.code+').'));
  }else if(message.type==='service-error'){void fail(new Error('Dịch vụ đã thoát. Mở lại ứng dụng để khôi phục.'));}
  else if(message.type==='stopped'){if(worker?.pid)try{process.kill(-worker.pid,'SIGKILL');}catch{}stopResolve();}
 });
 worker.once('error',error=>{rejectReady(error);stopResolve();});
 worker.once('exit',()=>{stopResolve();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Dịch vụ đã dừng'));}pending.clear();if(!quitting&&ready)void fail(new Error('Tiến trình điều khiển dịch vụ đã thoát.'));});
 worker.send({type:'start',settings,options:{root,resources,execPath:process.execPath,instance}});
 await boot;
 if(smoke){await smokeTest();await shutdown();app.exit(0);return;}
 window.webContents.setWindowOpenHandler(({url})=>{if(security.externalHttps(url))void shell.openExternal(url);return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!security.trustedLocal(url,base)){event.preventDefault();if(security.externalHttps(url))void shell.openExternal(url);}});
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===window.webContents&&permission==='clipboard-sanitized-write'));
 window.webContents.session.on('will-download',async(event,item)=>{const result=await dialog.showSaveDialog(window,{defaultPath:item.getFilename()});if(result.canceled)item.cancel();else item.setSavePath(result.filePath);});
 window.webContents.on('render-process-gone',()=>{if(!quitting)void fail(new Error('Giao diện đã thoát. Dữ liệu được giữ lại; mở lại ứng dụng để khôi phục.'));});
 window.on('closed',()=>{window=null;app.quit();});
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Dunnio Insights',submenu:[{role:'about'},{label:'Cấu hình Clarity…',click:configure},{label:'Sao lưu dữ liệu…',click:backup},{label:'Mở thư mục dữ liệu',click:()=>void shell.openPath(root)},{type:'separator'},{label:'Tắt ứng dụng',accelerator:'Command+Q',click:()=>app.quit()}]},
  {label:'Sửa',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'Xem',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));
 const ticket=await request('ticket',{});await window.loadURL(ticket.url);
}
function configure(){
 if(configuration){configuration.focus();return;}
 configuration=new BrowserWindow({parent:window,modal:true,width:570,height:370,resizable:false,title:'Cấu hình Clarity',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')}});
 configuration.webContents.setWindowOpenHandler(()=>({action:'deny'}));configuration.webContents.on('will-navigate',e=>e.preventDefault());
 configuration.on('closed',()=>{configuration=null;});void configuration.loadFile(path.join(__dirname,'configuration.html'));
}
ipcMain.handle('clarity-save',async(event,input)=>{
 if(!configuration||event.sender!==configuration.webContents)throw new Error('Forbidden');
 const project=String(input?.project||'').trim(),token=String(input?.token||'').trim();
 if(!security.validateClarity(project,token))throw new Error('Project ID hoặc token không hợp lệ');
 const next={...settings,CLARITY_PROJECT_ID:project,CLARITY_API_TOKEN:token};security.saveSettings(root,next,safeStorage);settings=next;await request('clarity',{projectId:project,token});configuration.close();return true;
});
async function backup(){try{const result=await request('backup',{});await dialog.showMessageBox(window,{message:'Đã sao lưu dữ liệu',detail:result.file});}catch{await dialog.showMessageBox(window,{type:'error',message:'Chưa tạo được bản sao lưu.'});}}
async function shutdown(){
 if(shutdownPromise)return shutdownPromise;quitting=true;
 shutdownPromise=(async()=>{
  for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Ứng dụng đang đóng'));}pending.clear();
  if(worker?.connected){worker.send({type:'stop'});await Promise.race([workerStopped,new Promise(resolve=>setTimeout(resolve,45000))]);if(worker.exitCode===null)try{process.kill(-worker.pid,'SIGKILL');}catch{}}
  if(window&&!window.isDestroyed()){await window.webContents.session.clearStorageData();await window.webContents.session.clearCache();window.destroy();}
  if(configuration&&!configuration.isDestroyed())configuration.destroy();
  security.removeSession(root,run);
 })();return shutdownPromise;
}
async function fail(error){
 if(smoke){console.error('macOS smoke failed:',error.message);await shutdown();app.exit(1);return;}
 if(!quitting){dialog.showErrorBox('Dunnio Insights',error.message);await shutdown();app.exit(1);}
}
async function smokeTest(){
 const assert=require('node:assert/strict');const ticket=await request('ticket',{}),value=new URL(ticket.url).hash.slice(1);
 const login=await fetch(base+'/api/desktop/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:value})});const session=await login.json();assert.equal(session.data.user.role,'admin');
 const replay=await fetch(base+'/api/desktop/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:value})});assert.equal(replay.status,403);
 assert.equal((await fetch(base+'/api/desktop/status')).status,403);
 const status=await request('status');assert.ok(status.counts.users>0);const saved=await request('backup',{});assert.ok(fs.statSync(saved.file).size>100);
 const browser=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,partition:'smoke-'+instance}});
 await browser.loadURL((await request('ticket',{})).url);
 for(let attempt=0;attempt<100;attempt++){if(browser.webContents.getURL().endsWith('/touch.html')&&await browser.webContents.executeJavaScript('!!document.getElementById("device")'))break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(browser.webContents.getURL().endsWith('/touch.html'));
 const checked=await browser.webContents.executeJavaScript(`(()=>{const select=document.getElementById('device');if(!select)return false;for(const option of select.options){select.value=option.value;select.dispatchEvent(new Event('change'));}return true})()`);assert.ok(checked);
 await browser.loadURL(base+'/analysis.html');assert.ok(await browser.webContents.executeJavaScript('!!document.getElementById("heatmapType")'));
 browser.destroy();console.log(JSON.stringify({success:true,version:app.getVersion(),arch:process.arch,admin:true,ticketReplayBlocked:true,privateControl:true,backup:true,touchUI:true,clarityUI:true}));
}
