using System;
using System.Diagnostics;
using System.IO;
using System.Web.Script.Serialization;

namespace DunnioDesktop {
 // Keep only a bounded diagnostic history; never accept tokens, URLs or request bodies.
 internal static class LifecycleLog {
  static readonly object gate=new object();
  internal static void Write(string root,string reason,string code){
   try{lock(gate){
    string file=Path.Combine(root,"lifecycle.jsonl");Directory.CreateDirectory(root);
    string history=File.Exists(file)?File.ReadAllText(file):"";
    if(history.Length>16000){int cut=history.IndexOf('\n',history.Length-8000);history=cut<0?"":history.Substring(cut+1);}
    string entry=new JavaScriptSerializer().Serialize(new{at=DateTime.UtcNow.ToString("o"),version="1.5.0",pid=Process.GetCurrentProcess().Id,reason=reason,code=code});
    File.WriteAllText(file,history+entry+Environment.NewLine);
   }}catch{} // Diagnostic I/O must not break startup/shutdown.
  }
 }
}
