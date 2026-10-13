using System;
using System.Collections.Generic;
using System.IO;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Web.Script.Serialization;

namespace DunnioDesktop {
 internal sealed class LocalSettings {
  internal readonly string Root;
  internal Dictionary<string,string> Values=new Dictionary<string,string>();
  static readonly byte[] Entropy=Encoding.UTF8.GetBytes("DunnioInsights.Desktop.v1");
  internal LocalSettings(string root,bool importReview=true){
   Root=Path.GetFullPath(root);Directory.CreateDirectory(Root);ProtectDirectory(Root);
   string file=Path.Combine(Root,"settings.protected");
   if(File.Exists(file)){byte[] plain=ProtectedData.Unprotect(File.ReadAllBytes(file),Entropy,DataProtectionScope.CurrentUser);try{Values=new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(Encoding.UTF8.GetString(plain));}finally{Array.Clear(plain,0,plain.Length);}}
   else{
    Values["DB_PASSWORD"]=Secret();Values["MYSQL_ROOT_PASSWORD"]=Secret();Values["JWT_SECRET"]=Secret();Values["INITIAL_ADMIN_PASSWORD"]=Secret();Values["ADMIN_USERNAME"]="admin";Values["INITIALIZED"]="false";
    string review=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".codex","local-services","dunnio-review","tracker.env");
    if(importReview&&File.Exists(review)){
     Dictionary<string,string> old=ParseEnv(review);
     foreach(string key in new string[]{"CLARITY_API_TOKEN","CLARITY_PROJECT_ID","CLARITY_PROJECT_NAME","JWT_SECRET","INITIAL_ADMIN_PASSWORD"})if(old.ContainsKey(key))Values[key]=old[key];
     if(old.ContainsKey("INITIAL_ADMIN_USERNAME"))Values["ADMIN_USERNAME"]=old["INITIAL_ADMIN_USERNAME"];
     Values["IMPORT_ENV"]=review;
    }
    Save();
   }
  }
  internal string Get(string key,string fallback=""){string v;return Values.TryGetValue(key,out v)?v:fallback;}
  internal void Save(){
   byte[] plain=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(Values));byte[] encrypted;
   try{encrypted=ProtectedData.Protect(plain,Entropy,DataProtectionScope.CurrentUser);}finally{Array.Clear(plain,0,plain.Length);}
   string file=Path.Combine(Root,"settings.protected"),temporary=Path.Combine(Root,"settings.new");File.WriteAllBytes(temporary,encrypted);
   if(File.Exists(file))File.Replace(temporary,file,null);else File.Move(temporary,file);
  }
  internal static Dictionary<string,string> ParseEnv(string file){
   Dictionary<string,string> result=new Dictionary<string,string>();
   foreach(string line in File.ReadAllLines(file)){int pos=line.IndexOf('=');if(pos>0&&!line.TrimStart().StartsWith("#"))result[line.Substring(0,pos).Trim()]=line.Substring(pos+1).Trim().Trim('"','\'');}
   return result;
  }
  internal static string Secret(){byte[] bytes=new byte[32];using(RandomNumberGenerator r=RandomNumberGenerator.Create())r.GetBytes(bytes);return BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();}
  internal static void ProtectDirectory(string root){
   if((File.GetAttributes(root)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Protected directory cannot be a junction.");
   DirectorySecurity acl=new DirectorySecurity();acl.SetAccessRuleProtection(true,false);
   foreach(SecurityIdentifier sid in new SecurityIdentifier[]{WindowsIdentity.GetCurrent().User,new SecurityIdentifier(WellKnownSidType.LocalSystemSid,null),new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid,null)})acl.AddAccessRule(new FileSystemAccessRule(sid,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
   new DirectoryInfo(root).SetAccessControl(acl);
  }
  // Cleanup only a verified child of the app's own runtime directory. Never follow junctions.
  internal static void DeleteRuntime(string path,string root){
   string allowed=Path.GetFullPath(Path.Combine(root,"runtime"))+Path.DirectorySeparatorChar,target=Path.GetFullPath(path);
   if((File.GetAttributes(Path.Combine(root,"runtime"))&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("Cleanup through a junction refused");
   if(!target.StartsWith(allowed,StringComparison.OrdinalIgnoreCase)||target.TrimEnd(Path.DirectorySeparatorChar)==allowed.TrimEnd(Path.DirectorySeparatorChar))throw new InvalidOperationException("Cleanup outside owned runtime refused");
   if(!Directory.Exists(target))return;
   DeleteTree(new DirectoryInfo(target));
  }
  static void DeleteTree(DirectoryInfo dir){
   if((dir.Attributes&FileAttributes.ReparsePoint)!=0){dir.Delete();return;}
   foreach(FileInfo file in dir.GetFiles()){file.Attributes=FileAttributes.Normal;file.Delete();}
   foreach(DirectoryInfo child in dir.GetDirectories())DeleteTree(child);
   dir.Delete();
  }
 }
}
