param(
 [string]$BundleRoot=(Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\DunnioInsights-1.5.0-win-x64'),
 [string]$ReferenceRoot=(Join-Path $env:LOCALAPPDATA 'DunnioInsights')
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$qa=Join-Path $repoRoot '.local\qa'
$testRoot=Join-Path $env:LOCALAPPDATA 'DunnioInsights-PackagingTests\native-options'
if(Get-ChildItem -LiteralPath (Join-Path $ReferenceRoot 'runtime') -Filter owner.json -Recurse -File -ErrorAction SilentlyContinue){throw 'Stop the reference workspace before copying its database for testing'}
if(Get-CimInstance Win32_Process -Filter "Name='mysqld.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($testRoot)}){throw 'Native option test workspace is still running'}
New-Item -ItemType Directory -Path $testRoot,$qa -Force | Out-Null
foreach($relative in @('settings.protected','data','snapshots')){
 $source=Join-Path $ReferenceRoot $relative
 if(Test-Path -LiteralPath $source -PathType Leaf){Copy-Item -LiteralPath $source -Destination (Join-Path $testRoot $relative) -Force;continue}
 Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {
  $target=Join-Path $testRoot ($relative+$_.FullName.Substring($source.Length))
  New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $target -Force
 }
}
$harness=Join-Path $qa 'NativeOptions.exe'
$stateFile=Join-Path $qa 'native-options-state.json'
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /platform:x64 "/out:$harness" /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll (Join-Path $PSScriptRoot 'tests\NativeOptions.cs')
if($LASTEXITCODE -ne 0){throw 'Native option test did not compile'}
$previousState=if(Test-Path -LiteralPath $stateFile){Get-Content -LiteralPath $stateFile -Raw}else{''}
$test=Start-Process -FilePath $harness -ArgumentList @(('"'+$BundleRoot+'"'),('"'+$testRoot+'"'),('"'+$stateFile+'"')) -WindowStyle Hidden -PassThru
try{
 $ready=$false
 for($attempt=0;$attempt -lt 250;$attempt++){
  if($test.HasExited){throw 'Native option controller exited before ready'}
  if(Test-Path -LiteralPath $stateFile){$state=Get-Content -LiteralPath $stateFile -Raw;if($state -ne $previousState){$ready=$true;break}}
  Start-Sleep -Milliseconds 200
 }
 if(-not $ready){throw 'Native option controller did not become ready'}
 $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
 if($state.controllerPid -ne $test.Id){throw 'Native option test owner mismatch'}
 $debugReady=$false
 for($attempt=0;$attempt -lt 50;$attempt++){
  try{Invoke-RestMethod -Uri ('http://127.0.0.1:'+$state.debugPort+'/json/version') -TimeoutSec 1 | Out-Null;$debugReady=$true;break}catch{Start-Sleep -Milliseconds 200}
 }
 if(-not $debugReady){throw 'Private Edge test did not become ready'}
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'tests\native-options.js') $stateFile
 if($LASTEXITCODE -ne 0){throw 'Native option interaction failed'}
 if(-not $test.WaitForExit(60000) -or $test.ExitCode -ne 0){throw 'Native option controller did not shut down cleanly'}
 if(Test-Path -LiteralPath $state.runRoot){throw 'Native option test left its browser cache'}
 Write-Output 'Native option interactions and clean shutdown: passed'
}finally{if(-not $test.HasExited){$test.Kill();$test.WaitForExit()};$test.Dispose()}
