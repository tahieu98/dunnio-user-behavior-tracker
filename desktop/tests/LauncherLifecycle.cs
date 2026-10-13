using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

// Exercise the real WinForms button handler in an isolated test workspace.
class LauncherLifecycle {
 [STAThread] static int Main(string[] args){
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  Assembly app=Assembly.LoadFrom(Path.Combine(args[0],"DunnioInsights.exe"));
  Type windowType=app.GetType("DunnioDesktop.MainWindow"),runtimeType=app.GetType("DunnioDesktop.DesktopRuntime"),processType=app.GetType("DunnioDesktop.OwnedProcess");
  BindingFlags flags=BindingFlags.Instance|BindingFlags.NonPublic;
  try{
   for(int cycle=0;cycle<2;cycle++){
    bool clicked=false;int backend=0,mysql=0,browser=0;string run=null;Exception failure=null;Stopwatch watch=Stopwatch.StartNew();
    using(EventWaitHandle stop=new EventWaitHandle(false,EventResetMode.AutoReset))using(EventWaitHandle activate=new EventWaitHandle(false,EventResetMode.AutoReset))
    using(Form window=(Form)windowType.GetConstructors(flags)[0].Invoke(new object[]{args[1],args[0],stop,activate}))using(System.Windows.Forms.Timer poll=new System.Windows.Forms.Timer()){
     object runtime=windowType.GetField("runtime",flags).GetValue(window);
     poll.Interval=100;
     poll.Tick+=delegate{
      try{
       if(watch.ElapsedMilliseconds>90000){failure=new Exception("Button shutdown timed out");poll.Stop();windowType.GetMethod("RequestClose",flags).Invoke(window,new object[]{"test-timeout"});return;}
       if(clicked||(bool)windowType.GetField("busy",flags).GetValue(window)||!(bool)runtimeType.GetField("Running",flags).GetValue(runtime))return;
       backend=(int)processType.GetField("Id",flags).GetValue(runtimeType.GetField("Backend",flags).GetValue(runtime));
       mysql=(int)processType.GetField("Id",flags).GetValue(runtimeType.GetField("Database",flags).GetValue(runtime));
       browser=(int)processType.GetField("Id",flags).GetValue(runtimeType.GetField("Browser",flags).GetValue(runtime));
       run=(string)runtimeType.GetField("RunRoot",flags).GetValue(runtime);
       clicked=true;((Button)windowType.GetField("off",flags).GetValue(window)).PerformClick();
      }catch(Exception e){failure=e;poll.Stop();windowType.GetMethod("RequestClose",flags).Invoke(window,new object[]{"test-failure"});}
     };
     poll.Start();Application.Run(window);poll.Stop();
    }
    if(failure!=null)throw failure;
    if(!clicked||run==null||Directory.Exists(run)||Exists(backend)||Exists(mysql)||Exists(browser))throw new Exception("Off button left an owned process or runtime cache");
   }
   Console.WriteLine("Off button closes controller, children and cache; same workspace reopens: passed (2 cycles)");return 0;
  }catch(Exception e){Console.Error.WriteLine(e.InnerException==null?e.Message:e.InnerException.Message);return 1;}
 }
 static bool Exists(int pid){try{using(Process p=Process.GetProcessById(pid))return !p.HasExited;}catch{return false;}}
}
