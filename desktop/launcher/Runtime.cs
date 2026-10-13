using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace DunnioDesktop {
 internal sealed class DesktopRuntime : IDisposable {
  internal readonly LocalSettings Settings;
  internal readonly string PackageRoot;
  internal string RunRoot,BaseUrl;
  internal int WebPort,DbPort;
  internal OwnedProcess Database,Backend,Browser;
  internal OwnedJob Job;
  internal bool Running,WasBrowserSeen;
  bool browserWindowSeen;
  DateTime browserOpenedAt;
  internal string Instance,ControlKey;
  readonly Action<string> progress;
  readonly object stopLock=new object();
  internal DesktopRuntime(string root,string packageRoot,Action<string> status,bool importReview=true){Settings=new LocalSettings(root,importReview);PackageRoot=packageRoot;progress=status;}
  string Node {get{return Path.Combine(PackageRoot,"runtime","node","node.exe");}}
  string MySqlRoot {get{return Path.Combine(PackageRoot,"runtime","mysql");}}
  string Payload {get{return Path.Combine(PackageRoot,"app");}}
  string Bin(string file){return Path.Combine(MySqlRoot,"bin",file);}
  internal Dictionary<string,string> EnvironmentForRun(){
   Dictionary<string,string> env=new Dictionary<string,string>();
   env["HOST"]="127.0.0.1";env["PORT"]=WebPort.ToString();env["NODE_ENV"]="production";env["ENABLE_DEMO"]="false";
   env["DB_HOST"]="127.0.0.1";env["DB_PORT"]=DbPort.ToString();env["DB_NAME"]="dunnio_insights";env["DB_USER"]="dunnio_local";env["DB_PASSWORD"]=Settings.Get("DB_PASSWORD");
   env["JWT_SECRET"]=Settings.Get("JWT_SECRET");env["JWT_EXPIRES_IN"]="2h";env["INITIAL_ADMIN_PASSWORD"]=Settings.Get("INITIAL_ADMIN_PASSWORD");
   env["CORS_ORIGIN"]=BaseUrl;env["EVENT_RETENTION_DAYS"]="400";env["DUNNIO_DESKTOP_MODE"]="true";
   foreach(string key in new string[]{"CLARITY_API_TOKEN","CLARITY_PROJECT_ID","CLARITY_PROJECT_NAME"})env[key]=Settings.Get(key);
   env["DESKTOP_CONTROL_KEY"]=ControlKey;env["DESKTOP_INSTANCE_ID"]=Instance;env["DESKTOP_ADMIN_USERNAME"]=Settings.Get("ADMIN_USERNAME","admin");
   env["DESKTOP_DATA_ROOT"]=Settings.Root;env["DESKTOP_RUN_ROOT"]=RunRoot;env["DESKTOP_MYSQL_ROOT_PASSWORD"]=Settings.Get("MYSQL_ROOT_PASSWORD");
   env["TEMP"]=RunRoot;env["TMP"]=RunRoot;
   env["DESKTOP_MYSQLDUMP"]=Bin("mysqldump.exe");env["DESKTOP_MYSQL_CLIENT"]=Bin("mysql.exe");
   env["DESKTOP_INITIAL_SETUP"]=Settings.Get("INITIALIZED")=="true"?"false":"true";
   env["DESKTOP_IMPORT_ENV"]=Settings.Get("INITIALIZED")=="true"?"":Settings.Get("IMPORT_ENV");
   return env;
  }
  internal void Start(bool openBrowser){
   if(Running)return;
   CheckWindowsRuntime();
   foreach(string f in new string[]{Node,Bin("mysqld.exe"),Bin("mysql.exe"),Bin("mysqldump.exe"),Path.Combine(Payload,"backend","src","desktop","entry.js")})if(!File.Exists(f))throw new FileNotFoundException("Bộ ứng dụng thiếu thành phần. Hãy giải nén đầy đủ gói ZIP.",f);
   CleanupStale();
   Instance=Guid.NewGuid().ToString("N");ControlKey=LocalSettings.Secret();
   RunRoot=Path.Combine(Settings.Root,"runtime",Instance);Directory.CreateDirectory(RunRoot);LocalSettings.ProtectDirectory(RunRoot);
   WebPort=FreePort();do{DbPort=FreePort();}while(DbPort==WebPort);BaseUrl="http://127.0.0.1:"+WebPort;
   Job=new OwnedJob();Dictionary<string,string> env=EnvironmentForRun();
   try{
    string mysqlData=Path.Combine(Settings.Root,"data","mysql");Directory.CreateDirectory(mysqlData);
    if(!File.Exists(Path.Combine(mysqlData,"auto.cnf"))){
     progress("Đang chuẩn bị dữ liệu lần đầu…");
     using(OwnedProcess init=Job.Start(Bin("mysqld.exe"),"--no-defaults --initialize-insecure --basedir="+OwnedJob.Quote(MySqlRoot)+" --datadir="+OwnedJob.Quote(mysqlData)+" --log-error="+OwnedJob.Quote(Path.Combine(RunRoot,"mysql-init.log")),PackageRoot,env)){if(!init.WaitForExit(90000)||init.ExitCode!=0)throw new InvalidOperationException("Không khởi tạo được MySQL riêng của ứng dụng.");}
    }
    progress("Đang mở kho dữ liệu…");
    Database=Job.Start(Bin("mysqld.exe"),"--no-defaults --basedir="+OwnedJob.Quote(MySqlRoot)+" --datadir="+OwnedJob.Quote(mysqlData)+" --port="+DbPort+" --bind-address=127.0.0.1 --mysqlx=OFF --skip-log-bin --innodb-buffer-pool-size=64M --performance-schema=OFF --max-connections=30 --log-error="+OwnedJob.Quote(Path.Combine(RunRoot,"mysql.log")),PackageRoot,env);
    WaitDatabase();
    progress(Settings.Get("INITIALIZED")=="true"?"Đang kiểm tra ứng dụng…":"Đang chuyển cấu hình và dữ liệu hiện có…");
    using(OwnedProcess setup=Job.Start(Node,OwnedJob.Quote(Path.Combine(Payload,"backend","src","desktop","setup.js")),Path.Combine(Payload,"backend"),env)){
     if(!setup.WaitForExit(90000)||setup.ExitCode!=0)throw new InvalidOperationException("Chuẩn bị dữ liệu chưa thành công. Kho dữ liệu nguồn cần đang chạy nếu đây là lần chuyển đầu tiên.");
    }
    Settings.Values["INITIALIZED"]="true";Settings.Save();
    progress("Đang mở Dunnio Insights…");
    Backend=Job.Start(Node,OwnedJob.Quote(Path.Combine(Payload,"backend","src","desktop","entry.js")),Path.Combine(Payload,"backend"),env);
    DateTime until=DateTime.UtcNow.AddSeconds(25);bool ready=false;
    while(DateTime.UtcNow<until){if(Backend.HasExited)throw new InvalidOperationException("Backend không khởi động được.");try{Dictionary<string,object> status=Call("status",null);Dictionary<string,object> data=(Dictionary<string,object>)status["data"];ready=Convert.ToString(data["instance"])==Instance;if(ready)break;}catch{}Thread.Sleep(150);}
    if(!ready)throw new TimeoutException("Ứng dụng chưa sẵn sàng.");
    Running=true;WriteState();progress("Đã bật · Phiên Admin đã sẵn sàng");
    if(openBrowser)OpenDashboard();
   }catch{Stop();throw;}
  }
  void CheckWindowsRuntime(){
   bool installed=true;
   foreach(string dll in new string[]{"vcruntime140.dll","vcruntime140_1.dll","msvcp140.dll"}){
    string file=Path.Combine(Environment.SystemDirectory,dll);if(!File.Exists(file)){installed=false;break;}
    FileVersionInfo v=FileVersionInfo.GetVersionInfo(file);if(v.FileMajorPart<14||(v.FileMajorPart==14&&v.FileMinorPart<40)){installed=false;break;}
   }
   if(installed)return;
   string installer=Path.Combine(PackageRoot,"runtime","prerequisites","vc_redist.x64.exe");
   if(!File.Exists(installer))throw new FileNotFoundException("Cần Microsoft Visual C++ Runtime. Gói ứng dụng thiếu bộ cài prerequisite.");
   using(System.Security.Cryptography.SHA256 sha=System.Security.Cryptography.SHA256.Create())using(FileStream f=File.OpenRead(installer)){
    string hash=BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();
    if(hash!=PrerequisiteInfo.Sha256)throw new InvalidOperationException("Bộ cài Microsoft Runtime khác hash đã xác minh. Giải nén lại gói gốc.");
   }
   progress("Cần hoàn tất cài Microsoft C++ Runtime cho Windows…");
   using(Process install=Process.Start(new ProcessStartInfo(installer,"/install /passive /norestart"){UseShellExecute=true,Verb="runas"})){
    if(!install.WaitForExit(180000))throw new TimeoutException("Windows runtime installation has not completed.");
    if(install.ExitCode!=0&&install.ExitCode!=3010&&install.ExitCode!=1638)throw new InvalidOperationException("Microsoft C++ Runtime chưa được cài. Hoàn tất bộ cài hoặc mở lại với quyền quản trị Windows.");
   }
  }
  void WaitDatabase(){
   DateTime until=DateTime.UtcNow.AddSeconds(35);
   while(DateTime.UtcNow<until){if(Database.HasExited)throw new InvalidOperationException("MySQL riêng đã thoát trước khi sẵn sàng.");try{using(TcpClient client=new TcpClient()){IAsyncResult pending=client.BeginConnect("127.0.0.1",DbPort,null,null);if(pending.AsyncWaitHandle.WaitOne(200)){client.EndConnect(pending);return;}}}catch{}Thread.Sleep(150);}
   throw new TimeoutException("Kho dữ liệu chưa sẵn sàng.");
  }
  internal Dictionary<string,object> Call(string endpoint,object data){
   HttpWebRequest request=(HttpWebRequest)WebRequest.Create(BaseUrl+"/api/desktop/"+endpoint);request.Timeout=endpoint=="backup"?120000:5000;request.ReadWriteTimeout=request.Timeout;request.Proxy=null;request.Headers["X-Dunnio-Control"]=ControlKey;
   request.Method=data==null?"GET":"POST";
   if(data!=null){byte[] body=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(data));request.ContentType="application/json";request.ContentLength=body.Length;using(Stream s=request.GetRequestStream())s.Write(body,0,body.Length);}
   using(WebResponse response=request.GetResponse())using(StreamReader r=new StreamReader(response.GetResponseStream())){
    Dictionary<string,object> result=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(r.ReadToEnd());if(!Convert.ToBoolean(result["success"]))throw new InvalidOperationException("Yêu cầu desktop chưa hoàn tất.");return result;
   }
  }
  internal string LoginLink(){return Convert.ToString(((Dictionary<string,object>)Call("ticket",new Dictionary<string,string>())["data"])["url"]);}
  internal void OpenDashboard(){
   if(!Running)throw new InvalidOperationException("Bật ứng dụng trước khi mở Dashboard.");
   string edge=FindEdge();string profile=Path.Combine(RunRoot,"browser");Directory.CreateDirectory(profile);
   OwnedProcess opened=Job.Start(edge,"--app="+OwnedJob.Quote(LoginLink())+" --user-data-dir="+OwnedJob.Quote(profile)+" --no-first-run --no-default-browser-check --disable-background-mode --disable-extensions --disable-sync --disable-component-update",PackageRoot,new Dictionary<string,string>());
   // A second launch hands its URL to the existing Edge process and exits. Preserve the live owner handle.
   if(Browser==null||Browser.HasExited){if(Browser!=null)Browser.Dispose();Browser=opened;browserWindowSeen=false;browserOpenedAt=DateTime.UtcNow;}else opened.Dispose();
   WasBrowserSeen=true;WriteState();
  }
  internal bool BrowserClosed(){
   if(!Running||!WasBrowserSeen||Job==null)return false;
   // Edge may hand off or replace launcher processes during navigation. The
   // visible app window, rather than helper counts or one PID, owns the UI lifetime.
   if(HasBrowserWindow()){browserWindowSeen=true;return false;}
   if(!browserWindowSeen&&DateTime.UtcNow-browserOpenedAt<TimeSpan.FromSeconds(30))return false;
   return browserWindowSeen||(Browser!=null&&Browser.HasExited);
  }
  internal bool BrowserFailed(){return Browser!=null&&Browser.HasExited&&Browser.ExitCode!=0;}
  internal string ServiceExit(){return "backend="+ExitStatus(Backend)+"; mysql="+ExitStatus(Database);}
  internal void Trace(string reason,string code){LifecycleLog.Write(Settings.Root,reason,code);}
  static string ExitStatus(OwnedProcess process){return process==null?"missing":process.HasExited?process.ExitCode.ToString():"running";}
  bool HasBrowserWindow(){
   bool found=false;
   if(!EnumWindows(delegate(IntPtr window,IntPtr unused){
    if(!IsWindowVisible(window))return true;
    StringBuilder type=new StringBuilder(128);GetClassName(window,type,type.Capacity);
    if(type.ToString()!="Chrome_WidgetWin_1")return true;
    uint pid;GetWindowThreadProcessId(window,out pid);if(Browser!=null&&pid==Browser.Id&&!Browser.HasExited||Job.Owns((int)pid))found=true;
    return true;
   },IntPtr.Zero))throw new System.ComponentModel.Win32Exception();
   return found;
  }
  internal string Backup(){if(!Running)throw new InvalidOperationException("Bật ứng dụng trước khi sao lưu.");return Convert.ToString(((Dictionary<string,object>)Call("backup",new Dictionary<string,string>())["data"])["file"]);}
  internal void SaveClarity(string project,string token){
   if(String.IsNullOrWhiteSpace(project)||String.IsNullOrWhiteSpace(token))throw new InvalidOperationException("Nhập Project ID và API token.");
   if(Running)Call("clarity",new Dictionary<string,string>{{"projectId",project.Trim()},{"token",token.Trim()}});
   Settings.Values["CLARITY_PROJECT_ID"]=project.Trim();Settings.Values["CLARITY_API_TOKEN"]=token.Trim();Settings.Save();
  }
  internal void Stop(){
   lock(stopLock){
    if(Job==null){Running=false;return;}
    progress("Đang đóng phiên và giải phóng tài nguyên…");
    CloseOwnedWindows();
    if(Backend!=null&&!Backend.HasExited){try{Call("shutdown",new Dictionary<string,string>());}catch{}}
    else if(Database!=null&&!Database.HasExited){
     // Startup failure still receives a graceful DB shutdown before the job fallback.
     try{Dictionary<string,string> env=EnvironmentForRun();env["MYSQL_PWD"]=Settings.Get("MYSQL_ROOT_PASSWORD");using(OwnedProcess p=Job.Start(Bin("mysqladmin.exe"),"--no-defaults --host=127.0.0.1 --port="+DbPort+" --user=root shutdown",PackageRoot,env))p.WaitForExit(10000);}catch{}
    }
    if(Backend!=null)try{Backend.WaitForExit(28000);}catch{}
    if(Database!=null)try{Database.WaitForExit(15000);}catch{}
    Job.Dispose();Job=null;Running=false;WasBrowserSeen=false;browserWindowSeen=false;
    foreach(OwnedProcess p in new OwnedProcess[]{Browser,Backend,Database})if(p!=null){try{p.WaitForExit(3000);}catch{}p.Dispose();}
    Browser=null;Backend=null;Database=null;
    bool cleaned=CleanupRun();
    progress(cleaned?"Đã tắt · Tiến trình và cache phiên đã được dọn":"Đã tắt · Cache đang chờ dọn ở lần mở tiếp theo");
   }
  }
  bool CleanupRun(){
   if(String.IsNullOrEmpty(RunRoot))return true;
   BitsCleanup.CancelDownloads(RunRoot,Settings.Root);
   for(int i=0;i<20;i++){try{LocalSettings.DeleteRuntime(RunRoot,Settings.Root);return true;}catch(IOException){Thread.Sleep(150);}catch(UnauthorizedAccessException){Thread.Sleep(150);}}
   return false;
  }
  void CleanupStale(){
   string root=Path.Combine(Settings.Root,"runtime");Directory.CreateDirectory(root);
   if((File.GetAttributes(root)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Runtime directory cannot be a junction.");
   foreach(string directory in Directory.GetDirectories(root)){
    // Same-data-root mutex is held by Program, so no other live session can own these directories.
    try{BitsCleanup.CancelDownloads(directory,Settings.Root);LocalSettings.DeleteRuntime(directory,Settings.Root);}catch(IOException){}catch(UnauthorizedAccessException){}
   }
  }
  void WriteState(){File.WriteAllText(Path.Combine(RunRoot,"owner.json"),new JavaScriptSerializer().Serialize(new{controllerPid=Process.GetCurrentProcess().Id,backendPid=Backend==null?0:Backend.Id,mysqlPid=Database==null?0:Database.Id,browserPid=Browser==null?0:Browser.Id,webPort=WebPort,dbPort=DbPort,instance=Instance}));}
  static int FreePort(){TcpListener listener=new TcpListener(IPAddress.Loopback,0);listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();return port;}
  static string FindEdge(){foreach(string baseDir in new string[]{Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)}){string file=Path.Combine(baseDir,"Microsoft","Edge","Application","msedge.exe");if(File.Exists(file))return file;}throw new FileNotFoundException("Cần Microsoft Edge để mở cửa sổ ứng dụng.");}
  delegate bool WindowCallback(IntPtr window,IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback,IntPtr data);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window,StringBuilder name,int count);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window,uint message,IntPtr wparam,IntPtr lparam);
  void CloseOwnedWindows(){if(Job==null)return;EnumWindows(delegate(IntPtr window,IntPtr unused){uint pid;GetWindowThreadProcessId(window,out pid);if(Job.Owns((int)pid))PostMessage(window,0x0010,IntPtr.Zero,IntPtr.Zero);return true;},IntPtr.Zero);}
  public void Dispose(){Stop();}
 }
}
