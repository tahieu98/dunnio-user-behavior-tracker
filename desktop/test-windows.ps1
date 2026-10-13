param([string]$BundleRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\DunnioInsights-1.5.0-win-x64'))
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$qa = Join-Path $repoRoot '.local\qa'
New-Item -ItemType Directory -Path $qa -Force | Out-Null
$exe = Join-Path $BundleRoot 'DunnioInsights.exe'
$testParent = Join-Path $env:LOCALAPPDATA 'DunnioInsights-PackagingTests'
$normal = Join-Path $testParent 'normal'
$crash = Join-Path $testParent 'crash'
function Run-NativeTest([string]$root,[string]$report) {
    $process = Start-Process -FilePath $exe -ArgumentList @('--self-test','--fresh','--data-dir',('"'+$root+'"'),'--report',('"'+$report+'"')) -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(90000)) { $process.Kill(); throw 'Native self-test timed out' }
    if ($process.ExitCode -ne 0) { if (Test-Path -LiteralPath $report) { Write-Output (Get-Content -LiteralPath $report -Raw) }; throw ('Native self-test failed: '+$process.ExitCode) }
    $data = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
    if (-not $data.success) { throw 'Native self-test assertions failed' }
    return $data
}
$first = Run-NativeTest $normal (Join-Path $qa 'windows-native-selftest.json')
$second = Run-NativeTest $normal (Join-Path $qa 'windows-native-repeat.json')

$held = Start-Process -FilePath $exe -ArgumentList @('--hold-test','--fresh','--data-dir',('"'+$crash+'"')) -WindowStyle Hidden -PassThru
$retainedMutex=$null
try {
    $stateFile = $null
    for ($attempt=0; $attempt -lt 250; $attempt++) {
        if ($held.HasExited) { throw 'Crash-test controller exited before ready' }
        $candidate = Get-ChildItem -LiteralPath (Join-Path $crash 'runtime') -Filter owner.json -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($candidate) { $stateFile = $candidate.FullName; break }
        Start-Sleep -Milliseconds 200
    }
    if (-not $stateFile) { throw 'Crash-test controller did not become ready' }
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($state.controllerPid -ne $held.Id) { throw 'Owner identity mismatch; refusing to terminate' }
    $duplicate = Start-Process -FilePath $exe -ArgumentList @('--self-test','--fresh','--data-dir',('"'+$crash+'"'),'--report',('"'+(Join-Path $qa 'windows-duplicate.json')+'"')) -WindowStyle Hidden -PassThru
    if (-not $duplicate.WaitForExit(10000)) { $duplicate.Kill(); throw 'Duplicate instance was not rejected' }
    if ($duplicate.ExitCode -ne 3) { throw 'Single-instance guard failed' }
    # Keep the named object alive after its owning process dies. createdNew
    # would remain false, but the next launcher must acquire the abandoned lock.
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value+'|'+[IO.Path]::GetFullPath($crash).ToLowerInvariant()
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $mutexHash=[BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($identity))).Replace('-','').Substring(0,24) } finally { $sha.Dispose() }
    $retainedMutex=[Threading.Mutex]::OpenExisting('Local\DunnioInsights-'+$mutexHash)
    $held.Kill(); $held.WaitForExit()
    $childrenStopped=$false
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        $remaining = @($state.backendPid,$state.mysqlPid) | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
        if (-not $remaining) { $childrenStopped=$true; break }
        Start-Sleep -Milliseconds 200
    }
    if (-not $childrenStopped) { throw 'Owned children survived forced controller termination' }
} finally { if (-not $held.HasExited) { $held.Kill(); $held.WaitForExit() }; $held.Dispose() }
try { $recovery = Run-NativeTest $crash (Join-Path $qa 'windows-native-recovery.json') } finally { if($retainedMutex){$retainedMutex.Dispose()} }
# Test the normal GUI lifecycle through the app's own stop IPC (no UI automation).
$guiRoot = Join-Path $testParent 'gui'
$gui = Start-Process -FilePath $exe -ArgumentList @('--fresh','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -PassThru
try {
    $guiState=$null
    for ($attempt=0; $attempt -lt 250; $attempt++) {
        if ($gui.HasExited) { throw 'GUI controller exited before ready' }
        $candidate=Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Filter owner.json -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($candidate) { $guiState=Get-Content -LiteralPath $candidate.FullName -Raw | ConvertFrom-Json; if ($guiState.browserPid -gt 0) { break } }
        Start-Sleep -Milliseconds 200
    }
    if (-not $guiState -or $guiState.browserPid -le 0) { throw 'Dedicated browser did not start' }
    $secondLaunch=Start-Process -FilePath $exe -ArgumentList @('--fresh','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -PassThru
    if(-not $secondLaunch.WaitForExit(10000) -or $secondLaunch.ExitCode -ne 0){throw 'Opening the shortcut again did not activate the existing instance'}
    Start-Sleep -Seconds 4
    $activeState=Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Filter owner.json -Recurse -File | Select-Object -First 1 | Get-Content -Raw | ConvertFrom-Json
    if($activeState.controllerPid -ne $gui.Id -or $activeState.backendPid -ne $guiState.backendPid -or $activeState.mysqlPid -ne $guiState.mysqlPid -or $activeState.browserPid -ne $guiState.browserPid){throw 'Second launch replaced a running owner or browser'}
    # A capture opens an additional headless browser. A browser crash must
    # stop all services but keep the controller's error status recoverable.
    Add-Type -AssemblyName System.Security
    Add-Type -AssemblyName System.Net.Http
    $guiPlain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $guiRoot 'settings.protected')),[Text.Encoding]::UTF8.GetBytes('DunnioInsights.Desktop.v1'),[Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { $guiSettings=[Text.Encoding]::UTF8.GetString($guiPlain) | ConvertFrom-Json } finally { [Array]::Clear($guiPlain,0,$guiPlain.Length) }
    $guiUrl='http://127.0.0.1:'+$guiState.webPort
    $guiLogin=Invoke-RestMethod -Uri ($guiUrl+'/api/auth/login') -Method Post -ContentType 'application/json' -Body (@{username='admin';password=$guiSettings.INITIAL_ADMIN_PASSWORD} | ConvertTo-Json -Compress)
    $captureClient=[Net.Http.HttpClient]::new()
    $captureRequest=[Net.Http.HttpRequestMessage]::new([Net.Http.HttpMethod]::Post,($guiUrl+'/api/behavior/snapshot'))
    $captureRequest.Headers.Authorization=[Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer',$guiLogin.data.token)
    $captureRequest.Content=[Net.Http.StringContent]::new((@{siteId=1;path='/blog/what-suit-color-to-choose.html';device='desktop';width=1440} | ConvertTo-Json -Compress),[Text.Encoding]::UTF8,'application/json')
    $captureTask=$captureClient.SendAsync($captureRequest)
    Start-Sleep -Milliseconds 1800
    Stop-Process -Id $guiState.browserPid -Force
    $browserAutoStopped=$false
    for($attempt=0;$attempt -lt 200;$attempt++){
        $guiServices=@($guiState.backendPid,$guiState.mysqlPid) | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
        if(-not $guiServices){$browserAutoStopped=$true;break}
        Start-Sleep -Milliseconds 200
    }
    $captureClient.Dispose();$captureRequest.Dispose()
    if(-not $browserAutoStopped){throw 'Browser closure during capture did not stop services'}
    if($gui.HasExited){throw 'Browser crash silently closed the controller instead of preserving error status'}
    if((Get-Content -LiteralPath (Join-Path $guiRoot 'lifecycle.jsonl') -Raw) -notmatch 'browser-exit'){throw 'Browser crash reason was not recorded'}
    $stopper=Start-Process -FilePath $exe -ArgumentList @('--stop','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -Wait -PassThru
    if ($stopper.ExitCode -ne 0 -or -not $gui.WaitForExit(60000)) { throw 'GUI stop command did not close the controller' }
    $guiFolders=@(Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Directory).Count
    $guiStopped=@($guiState.backendPid,$guiState.mysqlPid,$guiState.browserPid) | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
    if ($guiFolders -ne 0 -or $guiStopped) { throw 'GUI/browser shutdown left an owned process or cache' }
} finally { if (-not $gui.HasExited) { $gui.Kill(); $gui.WaitForExit() }; $gui.Dispose() }
# Reopen the same workspace after complete shutdown. Also exercise an existing
# controller whose backend has stopped: the shortcut must restart that workspace.
$reopened=Start-Process -FilePath $exe -ArgumentList @('--fresh','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -PassThru
try {
    $reopenedState=$null
    for($attempt=0;$attempt -lt 250;$attempt++){
        if($reopened.HasExited){throw 'Reopened controller exited before ready'}
        $candidate=Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Filter owner.json -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if($candidate){$reopenedState=Get-Content -LiteralPath $candidate.FullName -Raw | ConvertFrom-Json;if($reopenedState.controllerPid -eq $reopened.Id -and $reopenedState.browserPid -gt 0){break}}
        Start-Sleep -Milliseconds 200
    }
    if(-not $reopenedState -or $reopenedState.browserPid -le 0){throw 'Reopening after shutdown did not start Dashboard'}
    Stop-Process -Id $reopenedState.backendPid -Force
    for($attempt=0;$attempt -lt 200;$attempt++){
        if(-not (Test-Path -LiteralPath (Join-Path $guiRoot ('runtime\'+$reopenedState.instance)))){break}
        Start-Sleep -Milliseconds 200
    }
    if($reopened.HasExited -or (Get-Process -Id $reopenedState.mysqlPid -ErrorAction SilentlyContinue)){throw 'Backend failure did not leave a recoverable controller'}
    $activate=Start-Process -FilePath $exe -ArgumentList @('--fresh','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -PassThru
    if(-not $activate.WaitForExit(10000) -or $activate.ExitCode -ne 0){throw 'Stopped controller could not be reactivated'}
    $restarted=$null
    for($attempt=0;$attempt -lt 250;$attempt++){
        $candidate=Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Filter owner.json -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if($candidate){$restarted=Get-Content -LiteralPath $candidate.FullName -Raw | ConvertFrom-Json;if($restarted.controllerPid -eq $reopened.Id -and $restarted.backendPid -ne $reopenedState.backendPid -and $restarted.browserPid -gt 0){break}}
        Start-Sleep -Milliseconds 200
    }
    if(-not $restarted -or $restarted.backendPid -eq $reopenedState.backendPid -or $restarted.browserPid -le 0){throw 'Shortcut did not restart the stopped workspace'}
    $stopper=Start-Process -FilePath $exe -ArgumentList @('--stop','--data-dir',('"'+$guiRoot+'"')) -WindowStyle Hidden -Wait -PassThru
    if($stopper.ExitCode -ne 0 -or -not $reopened.WaitForExit(60000)){throw 'Reopened controller did not stop'}
    if(@(Get-ChildItem -LiteralPath (Join-Path $guiRoot 'runtime') -Directory).Count -ne 0){throw 'Reopened workspace left runtime cache'}
} finally {if(-not $reopened.HasExited){$reopened.Kill();$reopened.WaitForExit()};$reopened.Dispose()}
$buttonTest=Join-Path $qa 'LauncherLifecycle.exe'
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:exe /platform:x64 "/out:$buttonTest" /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll (Join-Path $PSScriptRoot 'tests\LauncherLifecycle.cs')
if($LASTEXITCODE -ne 0){throw 'Button lifecycle test did not compile'}
& $buttonTest $BundleRoot $guiRoot
if($LASTEXITCODE -ne 0){throw 'Off button lifecycle test failed'}
$summary = [ordered]@{success=$true;normal=$first;repeat=$second;duplicateRejected=$true;forcedTerminationStopsChildren=$childrenStopped;crashRecovery=$recovery;abandonedMutexRecoveredWithExistingHandle=$true;secondLaunchActivatesExistingOwner=$true;guiStopClosesController=$true;offButtonExitsAndReopens=$true;browserCrashRetainsControllerAndRecordsReason=$true;reopensAfterShutdown=$true;shortcutRestartsStoppedController=$true;dedicatedBrowserStopped=$true;browserCrashDuringCaptureStopsServices=$browserAutoStopped;browserCacheRemoved=$true;checkedAt=(Get-Date).ToUniversalTime().ToString('o')}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $qa 'windows-lifecycle.json') -Encoding utf8
Write-Output ($summary | ConvertTo-Json -Depth 8)
