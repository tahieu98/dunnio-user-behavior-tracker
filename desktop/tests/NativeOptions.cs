using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Run the real controller and private Edge app with a loopback debugging port
// only in this test harness. The production launcher never exposes that port.
class NativeOptions {
 [STAThread]static int Main(string[] args){
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  Assembly app=Assembly.LoadFrom(Path.Combine(args[0],"DunnioInsights.exe"));BindingFlags flags=BindingFlags.NonPublic|BindingFlags.Instance;
  Type windowType=app.GetType("DunnioDesktop.MainWindow"),runtimeType=app.GetType("DunnioDesktop.DesktopRuntime"),jobType=app.GetType("DunnioDesktop.OwnedJob"),ownedType=app.GetType("DunnioDesktop.OwnedProcess");
  ConstructorInfo constructor=windowType.GetConstructors(flags)[0];
  using(EventWaitHandle stop=new EventWaitHandle(false,EventResetMode.AutoReset))using(EventWaitHandle activate=new EventWaitHandle(false,EventResetMode.AutoReset))
  using(Form window=(Form)constructor.Invoke(constructor.GetParameters().Length==4?new object[]{args[1],args[0],stop,activate}:new object[]{args[1],args[0],stop})){
   try{
    object runtime=windowType.GetField("runtime",flags).GetValue(window);
    runtimeType.GetMethod("Start",flags).Invoke(runtime,new object[]{false});
    string run=(string)runtimeType.GetField("RunRoot",flags).GetValue(runtime),url=(string)runtimeType.GetField("BaseUrl",flags).GetValue(runtime);
    string login=(string)runtimeType.GetMethod("LoginLink",flags).Invoke(runtime,null),edge=(string)runtimeType.GetMethod("FindEdge",BindingFlags.NonPublic|BindingFlags.Static).Invoke(null,null);
    TcpListener listener=new TcpListener(IPAddress.Loopback,0);listener.Start();int port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();
    string profile=Path.Combine(run,"browser");Directory.CreateDirectory(profile);
    string command="--app=\""+login+"\" --user-data-dir=\""+profile+"\" --no-first-run --disable-background-mode --disable-extensions --disable-sync --disable-component-update --remote-debugging-address=127.0.0.1 --remote-debugging-port="+port;
    object browser=jobType.GetMethod("Start",flags).Invoke(runtimeType.GetField("Job",flags).GetValue(runtime),new object[]{edge,command,args[0],new System.Collections.Generic.Dictionary<string,string>()});
    runtimeType.GetField("Browser",flags).SetValue(runtime,browser);runtimeType.GetField("WasBrowserSeen",flags).SetValue(runtime,true);FieldInfo opened=runtimeType.GetField("browserOpenedAt",flags);if(opened!=null)opened.SetValue(runtime,DateTime.UtcNow);
    File.WriteAllText(args[2],new JavaScriptSerializer().Serialize(new{version=app.GetName().Version.ToString(),url=url,debugPort=port,controllerPid=System.Diagnostics.Process.GetCurrentProcess().Id,browserPid=(int)ownedType.GetField("Id",flags).GetValue(browser),runRoot=run}));
    using(System.Windows.Forms.Timer deadline=new System.Windows.Forms.Timer()){
     DateTime until=DateTime.UtcNow.AddMinutes(3);deadline.Interval=1000;deadline.Tick+=delegate{if(DateTime.UtcNow>until||!(bool)runtimeType.GetField("Running",flags).GetValue(runtime)){deadline.Stop();window.Close();}};deadline.Start();Application.Run(window);
    }
    if(Directory.Exists(run))throw new Exception("Native option test left a runtime folder");return 0;
   }catch(Exception e){Console.Error.WriteLine(e.InnerException==null?e.Message:e.InnerException.Message);return 1;}
  }
 }
}
