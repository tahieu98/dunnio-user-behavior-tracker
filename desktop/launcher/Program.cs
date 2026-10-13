using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly:AssemblyTitle("Dunnio Insights")]
[assembly:AssemblyDescription("Local Admin workspace and owned Windows process lifecycle")]
[assembly:AssemblyCompany("Dunnio")]
[assembly:AssemblyProduct("Dunnio Insights Desktop")]
[assembly:AssemblyVersion("1.5.0.0")]
[assembly:AssemblyFileVersion("1.5.0.0")]

namespace DunnioDesktop {
 internal static class Program {
  internal static string PackageRoot {get{return Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);}}
  internal static string DefaultDataRoot {get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"DunnioInsights");}}
  [STAThread] static int Main(string[] args){
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   Application.SetUnhandledExceptionMode(UnhandledExceptionMode.ThrowException);
   string dataRoot=Value(args,"--data-dir")??DefaultDataRoot;
   if(Array.IndexOf(args,"--install")>=0){try{Install();if(Array.IndexOf(args,"--quiet")<0)MessageBox.Show("Đã cài Dunnio Insights và tạo shortcut trên Desktop. Mở shortcut để bật ứng dụng.","Dunnio Insights");return 0;}catch(Exception e){if(Array.IndexOf(args,"--quiet")<0)MessageBox.Show(e.Message,"Cài đặt chưa hoàn tất");return 1;}}
   string identity=WindowsIdentity.GetCurrent().User.Value+"|"+Path.GetFullPath(dataRoot).ToLowerInvariant();string hash;
   using(SHA256 sha=SHA256.Create())hash=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(identity))).Replace("-","").Substring(0,24);
   string stopName="Local\\DunnioInsightsStop-"+hash;
   if(Array.IndexOf(args,"--stop")>=0){try{using(EventWaitHandle request=EventWaitHandle.OpenExisting(stopName))request.Set();}catch(WaitHandleCannotBeOpenedException){}return 0;}
   using(Mutex mutex=new Mutex(false,"Local\\DunnioInsights-"+hash))using(EventWaitHandle stopRequest=new EventWaitHandle(false,EventResetMode.AutoReset,stopName))using(EventWaitHandle activateRequest=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\DunnioInsightsActivate-"+hash)){
    // The named object can outlive its owner while another handle is open.
    // Test actual ownership, including recovery after an abandoned owner.
    bool acquired=false;try{acquired=mutex.WaitOne(0);}catch(AbandonedMutexException){acquired=true;}
    if(!acquired){
     if(Array.IndexOf(args,"--self-test")>=0||Array.IndexOf(args,"--hold-test")>=0||Array.IndexOf(args,"--initialize-only")>=0)return 3;
     AllowSetForegroundWindow(-1);activateRequest.Set();return 0;
    }
    DesktopRuntime runtime=null;
    try{
     runtime=new DesktopRuntime(dataRoot,PackageRoot,delegate(string message){},Array.IndexOf(args,"--fresh")<0);
     DesktopRuntime owner=runtime;
     AppDomain.CurrentDomain.UnhandledException+=delegate(object sender,UnhandledExceptionEventArgs e){Exception failure=e.ExceptionObject as Exception;LifecycleLog.Write(dataRoot,"unhandled-error",failure==null?"unknown":failure.GetType().Name);if(owner.Job!=null)owner.Job.Dispose();};
     if(Array.IndexOf(args,"--self-test")>=0)return SelfTest(runtime,Value(args,"--report")??Path.Combine(dataRoot,"self-test.json"));
     if(Array.IndexOf(args,"--initialize-only")>=0){runtime.Start(false);Dictionary<string,object> status=(Dictionary<string,object>)runtime.Call("status",null)["data"];runtime.Stop();string report=Value(args,"--report");if(report!=null)File.WriteAllText(report,new JavaScriptSerializer().Serialize(new{success=true,clarityConfigured=status["clarityConfigured"],counts=status["counts"],childrenStopped=!runtime.Running}));return 0;}
     if(Array.IndexOf(args,"--hold-test")>=0){runtime.Start(false);stopRequest.WaitOne();runtime.Stop();return 0;}
     runtime.Dispose();runtime=null;
     using(MainWindow window=new MainWindow(dataRoot,PackageRoot,stopRequest,activateRequest)){Application.Run(window);}
     return 0;
    }catch(Exception e){
     LifecycleLog.Write(dataRoot,"controller-error",e.GetType().Name);
     string report=Value(args,"--report");if(report!=null){Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(report)));File.WriteAllText(report,new JavaScriptSerializer().Serialize(new{success=false,error=e.Message}));}
     else MessageBox.Show(e.Message,"Dunnio Insights · Chưa khởi động được",MessageBoxButtons.OK,MessageBoxIcon.Error);
     return 1;
    }finally{if(runtime!=null)runtime.Dispose();mutex.ReleaseMutex();}
   }
  }
  [DllImport("user32.dll")]static extern bool AllowSetForegroundWindow(int processId);
  static string Value(string[] args,string key){for(int i=0;i<args.Length-1;i++)if(args[i]==key)return args[i+1];return null;}
  internal static Dictionary<string,object> PublicRequest(string url,object data){
   HttpWebRequest request=(HttpWebRequest)WebRequest.Create(url);request.Proxy=null;request.Timeout=5000;request.Method="POST";request.ContentType="application/json";byte[] body=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(data));using(Stream s=request.GetRequestStream())s.Write(body,0,body.Length);
   using(WebResponse response=request.GetResponse())using(StreamReader r=new StreamReader(response.GetResponseStream()))return new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(r.ReadToEnd());
  }
  static int SelfTest(DesktopRuntime runtime,string output){
   Stopwatch watch=Stopwatch.StartNew();runtime.Start(false);long start=watch.ElapsedMilliseconds;
   Dictionary<string,object> status=(Dictionary<string,object>)runtime.Call("status",null)["data"];
   string link=runtime.LoginLink(),ticket=link.Substring(link.IndexOf('#')+1);
   Dictionary<string,object> session=PublicRequest(runtime.BaseUrl+"/api/desktop/session",new{ticket=ticket});
   string role=Convert.ToString(((Dictionary<string,object>)((Dictionary<string,object>)session["data"])["user"])["role"]);
   bool replayBlocked=false;try{PublicRequest(runtime.BaseUrl+"/api/desktop/session",new{ticket=ticket});}catch(WebException e){if(e.Response!=null){replayBlocked=((HttpWebResponse)e.Response).StatusCode==HttpStatusCode.Forbidden;e.Response.Close();}}
   bool controllerBlocked=false;try{using(WebClient client=new WebClient())client.DownloadString(runtime.BaseUrl+"/api/desktop/status");}catch(WebException e){if(e.Response!=null){controllerBlocked=((HttpWebResponse)e.Response).StatusCode==HttpStatusCode.Forbidden;e.Response.Close();}}
   string backup=runtime.Backup();bool backupExists=File.Exists(backup)&&new FileInfo(backup).Length>100;
   int node=runtime.Backend.Id,mysql=runtime.Database.Id;long nodeRam=runtime.Backend.WorkingSet64,mysqlRam=runtime.Database.WorkingSet64;string run=runtime.RunRoot;
   runtime.Stop();long stop=watch.ElapsedMilliseconds-start;
   bool noChildren=!Exists(node)&&!Exists(mysql),noRuntime=!Directory.Exists(run);
   bool persisted=File.Exists(Path.Combine(runtime.Settings.Root,"settings.protected"))&&File.Exists(Path.Combine(runtime.Settings.Root,"data","mysql","auto.cnf"));
   byte[] encrypted=File.ReadAllBytes(Path.Combine(runtime.Settings.Root,"settings.protected"));bool secretEncrypted=!Encoding.UTF8.GetString(encrypted).Contains(runtime.Settings.Get("JWT_SECRET"));
   bool passed=role=="admin"&&replayBlocked&&controllerBlocked&&backupExists&&noChildren&&noRuntime&&persisted&&secretEncrypted;
   Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));
   File.WriteAllText(output,new JavaScriptSerializer().Serialize(new{success=passed,role=role,ticketReplayBlocked=replayBlocked,controllerRequiresSecret=controllerBlocked,backupCreated=backupExists,childrenExited=noChildren,runDirectoryRemoved=noRuntime,durableDataPreserved=persisted,secretsEncrypted=secretEncrypted,startMilliseconds=start,stopMilliseconds=stop,nodeWorkingSetMB=nodeRam/1048576,mysqlWorkingSetMB=mysqlRam/1048576,clarityConfigured=status["clarityConfigured"]}));
   return passed?0:2;
  }
  internal static bool Exists(int pid){try{using(Process p=Process.GetProcessById(pid))return !p.HasExited;}catch{return false;}}
  static void Install(){
   string target=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","DunnioInsights");
   if(String.Equals(Path.GetFullPath(target),Path.GetFullPath(PackageRoot),StringComparison.OrdinalIgnoreCase))return;
   Directory.CreateDirectory(target);LocalSettings.ProtectDirectory(target);CopyDirectory(PackageRoot,target);
   string exe=Path.Combine(target,"DunnioInsights.exe"),desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),menu=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"Dunnio Insights");Directory.CreateDirectory(menu);
   Shortcut(Path.Combine(desktop,"Dunnio Insights.lnk"),exe,target);Shortcut(Path.Combine(menu,"Dunnio Insights.lnk"),exe,target);
  }
  static void CopyDirectory(string source,string target){
   if((File.GetAttributes(source)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Install source cannot be a junction");
   Directory.CreateDirectory(target);
   foreach(string file in Directory.GetFiles(source))File.Copy(file,Path.Combine(target,Path.GetFileName(file)),true);
   foreach(string dir in Directory.GetDirectories(source))CopyDirectory(dir,Path.Combine(target,Path.GetFileName(dir)));
  }
  static void Shortcut(string file,string exe,string working){
   object shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));object link=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{file});
   try{Type t=link.GetType();t.InvokeMember("TargetPath",BindingFlags.SetProperty,null,link,new object[]{exe});t.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,link,new object[]{working});t.InvokeMember("IconLocation",BindingFlags.SetProperty,null,link,new object[]{exe+",0"});t.InvokeMember("Description",BindingFlags.SetProperty,null,link,new object[]{"Dunnio Insights · local Admin workspace"});t.InvokeMember("Save",BindingFlags.InvokeMethod,null,link,null);}finally{Marshal.FinalReleaseComObject(link);Marshal.FinalReleaseComObject(shell);}
  }
 }

 internal sealed class MainWindow : Form {
  readonly DesktopRuntime runtime;
  Label state,details;
  Button on,off,open,backup,settings;
  bool busy,closePending,canClose,cancelable,activatePending;
  int closedBrowserTicks;
  readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
  internal MainWindow(string root,string package,EventWaitHandle stopRequest,EventWaitHandle activateRequest){
   Text="Dunnio Insights · Windows";StartPosition=FormStartPosition.CenterScreen;ClientSize=new Size(650,430);MinimumSize=new Size(620,450);BackColor=Color.FromArgb(244,245,247);Font=new Font("Segoe UI",10);Icon=Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);
   Panel header=new Panel{Dock=DockStyle.Top,Height=100,BackColor=Color.FromArgb(17,30,49)};Controls.Add(header);
   header.Controls.Add(new Label{Text="DUNNIO INSIGHTS",ForeColor=Color.White,Font=new Font("Segoe UI",20,FontStyle.Bold),Location=new Point(26,21),AutoSize=true});
   header.Controls.Add(new Label{Text="Workspace trên Windows · Quyền ứng dụng: Admin",ForeColor=Color.FromArgb(200,211,229),Location=new Point(28,65),AutoSize=true});
   state=new Label{Text="Đang chuẩn bị…",Location=new Point(28,123),Size=new Size(590,35),Font=new Font("Segoe UI",13,FontStyle.Bold)};Controls.Add(state);
   details=new Label{Location=new Point(28,163),Size=new Size(590,48),ForeColor=Color.FromArgb(85,96,112),Text="Cấu hình và dữ liệu được giữ trên thiết bị. Khi đóng, ứng dụng dọn tiến trình và cache phiên."};Controls.Add(details);
   on=ButtonAt("Bật ứng dụng",28,220,180,true);off=ButtonAt("Tắt ứng dụng",220,220,180,false);open=ButtonAt("Mở Dashboard Admin",412,220,210,false);
   backup=ButtonAt("Sao lưu dữ liệu",28,280,180,false);settings=ButtonAt("Cấu hình Clarity",220,280,180,false);Button folder=ButtonAt("Thư mục dữ liệu",412,280,210,false);
   Controls.Add(new Label{Text="v1.5.0 · Token được mã hóa bằng Windows DPAPI\nBản local mở với quyền Admin; có thể dùng Run as administrator của Windows khi cần.",Location=new Point(28,348),Size=new Size(590,55),Font=new Font("Segoe UI",9),ForeColor=Color.FromArgb(97,107,123)});
   runtime=new DesktopRuntime(root,package,Status);
   on.Click+=delegate{Work(delegate{runtime.Start(true);});};off.Click+=delegate{RequestClose("off-button");};open.Click+=delegate{Work(delegate{runtime.OpenDashboard();});};
   backup.Click+=delegate{Work(delegate{string file=runtime.Backup();BeginInvoke((Action)delegate{if(!closePending)MessageBox.Show("Đã sao lưu dữ liệu tại:\n"+file,"Dunnio Insights");});},false,true);};
   settings.Click+=delegate{using(ClarityWindow dialog=new ClarityWindow(runtime.Settings.Get("CLARITY_PROJECT_ID"))){if(dialog.ShowDialog(this)==DialogResult.OK)Work(delegate{runtime.SaveClarity(dialog.ProjectId,dialog.Token);Status("Đã lưu cấu hình Clarity an toàn trên thiết bị");});}};
   folder.Click+=delegate{Process.Start(new ProcessStartInfo("explorer.exe",OwnedJob.Quote(root)){UseShellExecute=true});};
   Shown+=delegate{runtime.Trace("controller-start",null);Work(delegate{runtime.Start(true);});};
   FormClosing+=delegate(object sender,FormClosingEventArgs e){if(canClose)return;e.Cancel=true;RequestClose("controller-close");};
   timer.Interval=2000;timer.Tick+=delegate{
    if(stopRequest.WaitOne(0)){RequestClose("stop-command");return;}
    if(activateRequest.WaitOne(0))activatePending=true;
    if(activatePending&&!closePending){
     Show();if(WindowState==FormWindowState.Minimized)WindowState=FormWindowState.Normal;Activate();SetForegroundWindow(Handle);
     if(!busy){activatePending=false;closedBrowserTicks=0;Work(delegate{if(runtime.Running)runtime.OpenDashboard();else runtime.Start(true);});}
     return;
    }
    if(busy||!runtime.Running)return;
    if(runtime.Backend==null||runtime.Backend.HasExited||runtime.Database==null||runtime.Database.HasExited){string exit=runtime.ServiceExit();runtime.Trace("service-exit",exit);Work(delegate{runtime.Stop();Status("Dịch vụ gặp lỗi ("+exit+"). Bấm Bật ứng dụng để thử lại.");});return;}
    try{if(runtime.BrowserClosed())closedBrowserTicks++;else closedBrowserTicks=0;}catch(Exception e){closedBrowserTicks=0;runtime.Trace("browser-monitor-error",e.GetType().Name);return;}
    if(closedBrowserTicks>=2){closedBrowserTicks=0;if(runtime.BrowserFailed()){runtime.Trace("browser-exit",runtime.Browser.ExitCode.ToString());Work(delegate{runtime.Stop();Status("Dashboard gặp lỗi và đã dừng. Bấm Bật ứng dụng để thử lại.");});}else RequestClose("dashboard-close");}
   };timer.Start();UpdateButtons();
  }
  [DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr window);
  void RequestClose(string reason){if(closePending)return;runtime.Trace(reason,null);closePending=true;activatePending=false;if(!busy)Work(delegate{runtime.Stop();},true);else if(cancelable&&runtime.Running)ThreadPool.QueueUserWorkItem(delegate{runtime.Stop();});}
  Button ButtonAt(string text,int x,int y,int width,bool primary){Button b=new Button{Text=text,Location=new Point(x,y),Size=new Size(width,44),FlatStyle=FlatStyle.Flat,BackColor=primary?Color.FromArgb(33,78,138):Color.White,ForeColor=primary?Color.White:Color.FromArgb(27,38,55),Cursor=Cursors.Hand};b.FlatAppearance.BorderColor=Color.FromArgb(207,216,228);Controls.Add(b);return b;}
  void Status(string text){if(IsDisposed)return;if(InvokeRequired){try{BeginInvoke((Action)delegate{Status(text);});}catch(InvalidOperationException){}return;}state.Text=text;}
  void UpdateButtons(){on.Enabled=!busy&&!runtime.Running;off.Enabled=!busy&&runtime.Running;open.Enabled=!busy&&runtime.Running;backup.Enabled=!busy&&runtime.Running;settings.Enabled=!busy;}
  void Work(Action action,bool quit=false,bool canCancel=false){
   if(busy)return;busy=true;cancelable=canCancel;UpdateButtons();BackgroundWorker worker=new BackgroundWorker();worker.DoWork+=delegate{action();};
   worker.RunWorkerCompleted+=delegate(object sender,RunWorkerCompletedEventArgs e){busy=false;worker.Dispose();UpdateButtons();if(e.Error!=null){runtime.Trace("operation-error",e.Error.GetType().Name);Status("Chưa hoàn tất: "+e.Error.Message);if(!closePending)MessageBox.Show(e.Error.Message,"Dunnio Insights",MessageBoxButtons.OK,MessageBoxIcon.Error);}if(quit){runtime.Trace("controller-exit",null);canClose=true;Close();}else if(closePending)Work(delegate{runtime.Stop();},true);};worker.RunWorkerAsync();
  }
  protected override void Dispose(bool disposing){if(disposing){timer.Stop();timer.Dispose();runtime.Dispose();}base.Dispose(disposing);}
 }
 internal sealed class ClarityWindow : Form {
  TextBox project,token;
  internal string ProjectId {get{return project.Text;}}internal string Token {get{return token.Text;}}
  internal ClarityWindow(string current){
   Text="Cấu hình Microsoft Clarity";StartPosition=FormStartPosition.CenterParent;ClientSize=new Size(520,265);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;MinimizeBox=false;Font=new Font("Segoe UI",10);
   Controls.Add(new Label{Text="Project ID",Location=new Point(20,20),AutoSize=true});project=new TextBox{Text=current,Location=new Point(20,48),Size=new Size(480,28),MaxLength=100};Controls.Add(project);
   Controls.Add(new Label{Text="API token mới (không hiển thị token đang lưu)",Location=new Point(20,87),AutoSize=true});token=new TextBox{UseSystemPasswordChar=true,Location=new Point(20,115),Size=new Size(480,28),MaxLength=8192};Controls.Add(token);
   Controls.Add(new Label{Text="Token được lưu mã hóa theo tài khoản Windows hiện tại.",Location=new Point(20,158),Size=new Size(480,30),ForeColor=Color.DimGray});
   Button save=new Button{Text="Lưu cấu hình",DialogResult=DialogResult.OK,Location=new Point(300,211),Size=new Size(110,34)},cancel=new Button{Text="Hủy",DialogResult=DialogResult.Cancel,Location=new Point(420,211),Size=new Size(80,34)};Controls.Add(save);Controls.Add(cancel);AcceptButton=save;CancelButton=cancel;
  }
 }
}
