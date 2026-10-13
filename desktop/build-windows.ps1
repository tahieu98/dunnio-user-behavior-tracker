param(
    [string]$NodeExe = 'C:\Program Files\nodejs\node.exe',
    [string]$MySqlRoot = 'C:\laragon\bin\mysql\mysql-8.4.3-winx64',
    [switch]$SkipZip,
    [switch]$Incremental
)
$ErrorActionPreference = 'Stop'
function Copy-Tree([string]$source,[string]$target) {
    $sourceFull=[IO.Path]::GetFullPath($source).TrimEnd([IO.Path]::DirectorySeparatorChar)
    Get-ChildItem -LiteralPath $sourceFull -Recurse -File | ForEach-Object {
        $destination=Join-Path $target $_.FullName.Substring($sourceFull.Length+1)
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    }
}
$repoRoot = Split-Path -Parent $PSScriptRoot
$appVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'backend\package.json') -Raw | ConvertFrom-Json).version
$bundleName = "DunnioInsights-$appVersion-win-x64"
$bundleRoot = Join-Path $repoRoot "dist\$bundleName"
$stageParent = Join-Path $repoRoot '.local\windows-build'
$bundleFull = [IO.Path]::GetFullPath($bundleRoot)
$expectedDist = [IO.Path]::GetFullPath((Join-Path $repoRoot 'dist')) + [IO.Path]::DirectorySeparatorChar
if (-not $bundleFull.StartsWith($expectedDist,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected bundle target' }
if (Test-Path -LiteralPath $bundleRoot) {
    $running = Get-Process DunnioInsights -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $bundleRoot 'DunnioInsights.exe') }
    if ($running) { throw 'Close the bundle launcher before rebuilding.' }
    if (-not $Incremental) { Remove-Item -LiteralPath $bundleFull -Recurse -Force }
}
New-Item -ItemType Directory -Path $bundleRoot,$stageParent -Force | Out-Null
foreach ($dir in @('app\backend','app\frontend','app\tracker','runtime\node','runtime\mysql\bin','runtime\prerequisites','licenses','source\launcher')) { New-Item -ItemType Directory -Path (Join-Path $bundleRoot $dir) -Force | Out-Null }
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $bundleRoot 'runtime\node\node.exe')
$mysqlBin = Join-Path $MySqlRoot 'bin'
foreach ($binary in @('mysqld.exe','mysql.exe','mysqladmin.exe','mysqldump.exe')) { Copy-Item -LiteralPath (Join-Path $mysqlBin $binary) -Destination (Join-Path $bundleRoot 'runtime\mysql\bin') }
Get-ChildItem -LiteralPath $mysqlBin -Filter '*.dll' -File | Where-Object { $_.Name -notmatch 'debug' } | Copy-Item -Destination (Join-Path $bundleRoot 'runtime\mysql\bin')
foreach ($directory in @('share','lib','bin\sasl2')) { if (Test-Path -LiteralPath (Join-Path $MySqlRoot $directory)) { Copy-Tree (Join-Path $MySqlRoot $directory) (Join-Path $bundleRoot "runtime\mysql\$directory") } }
$mysqlLicense=Join-Path $MySqlRoot 'LICENSE'
if (-not (Test-Path -LiteralPath $mysqlLicense)) { $mysqlLicense=[IO.Path]::GetFullPath((Join-Path $MySqlRoot '../../licenses/MYSQL-LICENSE.txt')) }
Copy-Item -LiteralPath $mysqlLicense -Destination (Join-Path $bundleRoot 'licenses\MYSQL-LICENSE.txt')
if (Test-Path -LiteralPath (Join-Path $MySqlRoot 'docs')) { Copy-Tree (Join-Path $MySqlRoot 'docs') (Join-Path $bundleRoot 'licenses\mysql-notices') }
foreach ($dir in @('src','migrations','scripts')) { Copy-Tree (Join-Path $repoRoot "backend\$dir") (Join-Path $bundleRoot "app\backend\$dir") }
foreach ($file in @('package.json','package-lock.json')) { Copy-Item -LiteralPath (Join-Path $repoRoot "backend\$file") -Destination (Join-Path $bundleRoot "app\backend\$file") }
Copy-Tree (Join-Path $repoRoot 'frontend') (Join-Path $bundleRoot 'app\frontend')
Get-ChildItem -LiteralPath (Join-Path $repoRoot 'tracker') -File | Copy-Item -Destination (Join-Path $bundleRoot 'app\tracker')
Push-Location (Join-Path $bundleRoot 'app\backend')
try { npm ci --omit=dev --ignore-scripts --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } } finally { Pop-Location }
# Source files and license material travel with the portable distribution. Never copy .env or user database files.
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'launcher') -File | Copy-Item -Destination (Join-Path $bundleRoot 'source\launcher')
Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $bundleRoot 'source\build-windows.ps1')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'USER-GUIDE.md') -Destination (Join-Path $bundleRoot 'HUONG-DAN.md')
New-Item -ItemType Directory -Path (Join-Path $bundleRoot 'docs') -Force | Out-Null
foreach ($document in @('13-ORDER3-DESIGN.md','14-ORDER3-IMPLEMENTATION.md','15-ORDER3-OPERATIONS.md')) { Copy-Item -LiteralPath (Join-Path $repoRoot "planning-docs\$document") -Destination (Join-Path $bundleRoot 'docs') }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'THIRD-PARTY-NOTICES.txt') -Destination (Join-Path $bundleRoot 'licenses\THIRD-PARTY-NOTICES.txt')
$nodeVersion = (& $NodeExe --version).Trim()
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile (Join-Path $bundleRoot 'licenses\NODE-LICENSE.txt')
$vcCache = Join-Path $stageParent 'vc_redist.x64.exe'
if (-not (Test-Path -LiteralPath $vcCache)) { Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' -OutFile $vcCache }
$vcSignature = Get-AuthenticodeSignature -LiteralPath $vcCache
if ($vcSignature.Status -ne 'Valid' -or $vcSignature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw 'Microsoft VC++ prerequisite signature verification failed' }
Copy-Item -LiteralPath $vcCache -Destination (Join-Path $bundleRoot 'runtime\prerequisites\vc_redist.x64.exe')
$vcExpectedHash = (Get-FileHash -LiteralPath $vcCache -Algorithm SHA256).Hash.ToLowerInvariant()
$generatedInfo = Join-Path $stageParent 'PrerequisiteInfo.cs'
('namespace DunnioDesktop { internal static class PrerequisiteInfo { internal const string Sha256 = "'+$vcExpectedHash+'"; } }') | Set-Content -LiteralPath $generatedInfo -Encoding utf8
Copy-Item -LiteralPath $generatedInfo -Destination (Join-Path $bundleRoot 'source\launcher\PrerequisiteInfo.cs')

# Generate the app's small native icon from its D monogram.
Add-Type -AssemblyName System.Drawing
$bitmap = [Drawing.Bitmap]::new(64,64)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.Color]::FromArgb(17,30,49))
$border = [Drawing.Pen]::new([Drawing.Color]::FromArgb(218,186,122),2)
$graphics.DrawRectangle($border,8,6,47,51)
$font = [Drawing.Font]::new('Georgia',34,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
$brush = [Drawing.SolidBrush]::new([Drawing.Color]::White)
$graphics.DrawString('D',$font,$brush,14,10)
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $stageParent 'dunnio.ico'
$iconStream = [IO.File]::Create($iconPath)
try { $icon.Save($iconStream) } finally { $iconStream.Dispose(); $icon.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $border.Dispose(); $font.Dispose(); $brush.Dispose() }
$compiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$sourceFiles = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'launcher') -Filter '*.cs' | ForEach-Object { $_.FullName }
$sourceFiles += $generatedInfo
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /debug- /utf8output "/out:$bundleRoot\DunnioInsights.exe" "/win32manifest:$PSScriptRoot\launcher\app.manifest" "/win32icon:$iconPath" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll $sourceFiles
if ($LASTEXITCODE -ne 0) { throw 'Native launcher compilation failed' }
@'
<?xml version="1.0" encoding="utf-8"?><configuration><startup><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>
'@ | Set-Content -LiteralPath (Join-Path $bundleRoot 'DunnioInsights.exe.config') -Encoding utf8
# A double-clickable native installation entry point; all files remain per-user.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Install.vbs') -Destination (Join-Path $bundleRoot 'Install.vbs')
$manifest = [ordered]@{version=$appVersion;architecture='x64';nodeVersion=$nodeVersion;mysqlVersion='8.4.3';builtAt=(Get-Date).ToUniversalTime().ToString('o');containsCredentials=$false;files=@()}
$manifest.files = @(Get-ChildItem -LiteralPath $bundleRoot -File -Recurse | Where-Object { $_.FullName -ne (Join-Path $bundleRoot 'manifest.json') } | ForEach-Object { @{path=$_.FullName.Substring($bundleRoot.Length+1).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant();bytes=$_.Length} })
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $bundleRoot 'manifest.json') -Encoding utf8
if (-not $SkipZip) {
    $zipPath = Join-Path $repoRoot "dist\$bundleName.zip"
    Compress-Archive -LiteralPath $bundleRoot -DestinationPath $zipPath -CompressionLevel Optimal -Force
    $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    "$zipHash  $bundleName.zip" | Set-Content -LiteralPath "$zipPath.sha256" -Encoding ascii
    Write-Output "Built: $zipPath"
}
Write-Output "Launcher: $bundleRoot\DunnioInsights.exe"
