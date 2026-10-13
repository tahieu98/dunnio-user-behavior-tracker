[CmdletBinding(SupportsShouldProcess=$true)]param()
$ErrorActionPreference='Stop'
$cleanupWorkspace=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$cleanupTestRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'DunnioInsights-PackagingTests'))
$cleanupTargets=@()
foreach($version in @('1.2.0','1.3.0','1.3.1')){
 foreach($suffix in @('','.zip','.zip.sha256')){
  $cleanupTargets+=Join-Path $cleanupWorkspace ('dist\DunnioInsights-'+$version+'-win-x64'+$suffix)
 }
}
foreach($relative in @('.local\windows-build','.local\qa\NativeOptions.exe','.local\qa\LauncherLifecycle.exe','.local\reopen.exe','.local\reopen.cs')){$cleanupTargets+=Join-Path $cleanupWorkspace $relative}
$cleanupTargets+=$cleanupTestRoot
# This script preserves the installed application, release 1.3.2 and real data.
$cleanupProcesses=Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('DunnioInsights.exe','NativeOptions.exe','LauncherLifecycle.exe','mysqld.exe','msedge.exe')}
foreach($target in $cleanupTargets){
 $cleanupFull=[IO.Path]::GetFullPath($target)
 if($cleanupFull -ne $cleanupTestRoot -and -not $cleanupFull.StartsWith($cleanupWorkspace+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Target outside the fixed cleanup scope'}
 if(-not(Test-Path -LiteralPath $cleanupFull)){continue}
 if($cleanupProcesses | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($cleanupFull+'\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.Contains($cleanupFull))}){throw ('Close the old test process before cleanup: '+$cleanupFull)}
 $cleanupItem=Get-Item -LiteralPath $cleanupFull -Force
 if(($cleanupItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Cleanup target is a junction'}
 if($cleanupItem.PSIsContainer -and (Get-ChildItem -LiteralPath $cleanupFull -Force -Recurse | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0} | Select-Object -First 1)){throw 'Cleanup target contains a junction'}
 if($PSCmdlet.ShouldProcess($cleanupFull,'Remove old package or isolated test resource')){Remove-Item -LiteralPath $cleanupFull -Recurse -Force;Write-Output ('Removed: '+$cleanupFull)}
}
