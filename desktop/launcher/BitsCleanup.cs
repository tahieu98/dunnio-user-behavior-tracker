using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace DunnioDesktop {
 // Edge can delegate component downloads to BITS. Cancel only current-user downloads wholly inside this app's session.
 internal static class BitsCleanup {
  static void Release(object value){if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
  internal static void CancelDownloads(string session,string dataRoot){
   string parent=Path.GetFullPath(Path.Combine(dataRoot,"runtime"))+Path.DirectorySeparatorChar,full=Path.GetFullPath(session);
   if(!full.StartsWith(parent,StringComparison.OrdinalIgnoreCase)||!Regex.IsMatch(Path.GetFileName(full),"^[a-f0-9]{32}$"))throw new InvalidOperationException("Invalid transfer cleanup session");
   if(Directory.Exists(full)&&(File.GetAttributes(full)&FileAttributes.ReparsePoint)!=0)return;
   string prefix=full+Path.DirectorySeparatorChar;IBitsManager manager=null;IBitsJobs jobs=null;
   try{
    manager=(IBitsManager)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("4991d34b-80a1-4291-83b6-3328366b9097")));
    if(manager.EnumJobs(0,out jobs)<0)return;
    IBitsJob job;uint fetched;
    while(jobs.Next(1,out job,out fetched)==0&&fetched==1){
     try{
      uint type;if(job.GetType(out type)<0||type!=0)continue;
      IBitsFiles files=null;bool found=false,owned=true;
      try{
       if(job.EnumFiles(out files)<0)continue;IBitsFile file;uint count;
       while(files.Next(1,out file,out count)==0&&count==1){
        try{string target;if(file.GetLocalName(out target)<0||String.IsNullOrWhiteSpace(target)||!Path.GetFullPath(target).StartsWith(prefix,StringComparison.OrdinalIgnoreCase))owned=false;found=true;}finally{Release(file);}
       }
      }finally{Release(files);}
      if(found&&owned)job.Cancel();
     }finally{Release(job);}
    }
   }catch(COMException){}finally{Release(jobs);Release(manager);}
  }
 }
 [ComImport,Guid("5ce34c0d-0dc9-4c1f-897c-daa1b78cee7c"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IBitsManager {
  [PreserveSig]int CreateJob([MarshalAs(UnmanagedType.LPWStr)]string name,uint type,out Guid id,out IBitsJob job);
  [PreserveSig]int GetJob(ref Guid id,out IBitsJob job);
  [PreserveSig]int EnumJobs(uint flags,out IBitsJobs jobs);
 }
 [ComImport,Guid("1af4f612-3b71-466f-8f58-7b6f73ac57ad"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IBitsJobs {
  [PreserveSig]int Next(uint requested,out IBitsJob job,out uint fetched);
 }
 [ComImport,Guid("37668d37-507e-4160-9316-26306d150b12"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IBitsJob {
  [PreserveSig]int AddFileSet(uint count,IntPtr files);
  [PreserveSig]int AddFile([MarshalAs(UnmanagedType.LPWStr)]string remote,[MarshalAs(UnmanagedType.LPWStr)]string local);
  [PreserveSig]int EnumFiles(out IBitsFiles files);
  [PreserveSig]int Suspend();
  [PreserveSig]int Resume();
  [PreserveSig]int Cancel();
  [PreserveSig]int Complete();
  [PreserveSig]int GetId(out Guid id);
  [PreserveSig]int GetType(out uint type);
 }
 [ComImport,Guid("ca51e165-c365-424c-8d41-24aaa4ff3c40"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IBitsFiles {
  [PreserveSig]int Next(uint requested,out IBitsFile file,out uint fetched);
 }
 [ComImport,Guid("01b7bd23-fb88-4a77-8490-5891d3e4653a"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IBitsFile {
  [PreserveSig]int GetRemoteName([MarshalAs(UnmanagedType.LPWStr)]out string value);
  [PreserveSig]int GetLocalName([MarshalAs(UnmanagedType.LPWStr)]out string value);
 }
}
