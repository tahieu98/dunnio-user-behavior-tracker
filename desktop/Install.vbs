Option Explicit
Dim shell, files, root, result
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(WScript.ScriptFullName)
result = shell.Run("""" & root & "\DunnioInsights.exe"" --install", 1, True)
