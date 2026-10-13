using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace DunnioDesktop {
 internal sealed class OwnedProcess : IDisposable {
  IntPtr handle;internal readonly int Id;
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  internal OwnedProcess(IntPtr process,uint pid){handle=process;Id=(int)pid;}
  internal bool HasExited {get{uint code;return handle==IntPtr.Zero||!GetExitCodeProcess(handle,out code)||code!=259;}}
  internal int ExitCode {get{uint code;if(handle==IntPtr.Zero||!GetExitCodeProcess(handle,out code))throw new Win32Exception();return (int)code;}}
  internal bool WaitForExit(int milliseconds){return handle==IntPtr.Zero||WaitForSingleObject(handle,(uint)milliseconds)==0;}
  internal long WorkingSet64 {get{using(Process process=Process.GetProcessById(Id))return process.WorkingSet64;}}
  public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
 }
 // Children start suspended, are assigned before execution, and cannot escape the lifetime of the controller.
 internal sealed class OwnedJob : IDisposable {
  IntPtr handle;
  [StructLayout(LayoutKind.Sequential)] struct BasicLimit { public long ProcessTime,JobTime;public uint Flags;public UIntPtr Min,Max;public uint ActiveLimit;public UIntPtr Affinity;public uint Priority,Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit { public BasicLimit Basic;public IoCounters IO;public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {public long User,Kernel,PeriodUser,PeriodKernel;public uint PageFaults,Total,Active,Terminated;}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct StartupInfo {public uint Size;public string Reserved,Desktop,Title;public uint X,Y,XSize,YSize,XCount,YCount,Fill,Flags;public short Show,ReservedSize;public IntPtr ReservedPtr,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo {public IntPtr Process,Thread;public uint ProcessId,ThreadId;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,IntPtr data,uint length);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int info,out Accounting data,uint size,IntPtr returned);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool assigned);
  [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr procAttrs,IntPtr threadAttrs,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupInfo startup,out ProcessInfo process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  internal OwnedJob(){
   handle=CreateJobObject(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw new Win32Exception();
   ExtendedLimit limits=new ExtendedLimit();limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE
   IntPtr p=Marshal.AllocHGlobal(Marshal.SizeOf(limits));
   try{Marshal.StructureToPtr(limits,p,false);if(!SetInformationJobObject(handle,9,p,(uint)Marshal.SizeOf(limits)))throw new Win32Exception();}finally{Marshal.FreeHGlobal(p);}
  }
  internal uint ActiveCount {get{if(handle==IntPtr.Zero)return 0;Accounting a;if(!QueryInformationJobObject(handle,1,out a,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero))throw new Win32Exception();return a.Active;}}
  internal bool Owns(int pid){IntPtr process=OpenProcess(0x1000,false,pid);if(process==IntPtr.Zero)return false;try{bool result;return IsProcessInJob(process,handle,out result)&&result;}finally{CloseHandle(process);}}
  internal OwnedProcess Start(string exe,string arguments,string cwd,Dictionary<string,string> variables){
   SortedDictionary<string,string> env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
   foreach(System.Collections.DictionaryEntry e in Environment.GetEnvironmentVariables())env[(string)e.Key]=(string)e.Value;
   // The host's development environment must never bleed into a packaged app.
   foreach(string key in new string[]{"DOTENV_CONFIG_PATH","NODE_OPTIONS","NODE_PATH","MYSQL_PWD","RUN_DB_TESTS","TEST_BASE_URL"})env.Remove(key);
   foreach(KeyValuePair<string,string> e in variables)env[e.Key]=e.Value;
   StringBuilder block=new StringBuilder();foreach(KeyValuePair<string,string> e in env)block.Append(e.Key).Append('=').Append(e.Value).Append('\0');block.Append('\0');
   IntPtr ptr=Marshal.StringToHGlobalUni(block.ToString());ProcessInfo process;StartupInfo startup=new StartupInfo();startup.Size=(uint)Marshal.SizeOf(startup);
   try{
    if(!CreateProcess(exe,new StringBuilder(Quote(exe)+" "+arguments),IntPtr.Zero,IntPtr.Zero,false,0x08000000|0x00000400|0x00000004,ptr,cwd,ref startup,out process))throw new Win32Exception();
    try{
     if(!AssignProcessToJobObject(handle,process.Process)){TerminateProcess(process.Process,99);throw new Win32Exception();}
     if(ResumeThread(process.Thread)==UInt32.MaxValue){TerminateProcess(process.Process,99);throw new Win32Exception();}
     return new OwnedProcess(process.Process,process.ProcessId);
    }catch{CloseHandle(process.Process);throw;}finally{CloseHandle(process.Thread);}
   }finally{Marshal.FreeHGlobal(ptr);}
  }
  // Windows command-line quoting, including paths ending with backslashes.
  internal static string Quote(string value){
   StringBuilder b=new StringBuilder("\"");int slashes=0;
   foreach(char c in value){if(c=='\\'){slashes++;continue;}if(c=='"'){b.Append('\\',slashes*2+1).Append(c);slashes=0;continue;}b.Append('\\',slashes).Append(c);slashes=0;}
   return b.Append('\\',slashes*2).Append('"').ToString();
  }
  public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
 }
}
