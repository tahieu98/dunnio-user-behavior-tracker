[CmdletBinding()]
param(
    [string]$DeliveryRoot = 'C:\laragon\www\DunnioInsights-macOS-1.5.0'
)
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$delivery=[IO.Path]::GetFullPath($DeliveryRoot)
$allowedParent=[IO.Path]::GetFullPath('C:\laragon\www')+[IO.Path]::DirectorySeparatorChar
if(-not $delivery.StartsWith($allowedParent,[StringComparison]::OrdinalIgnoreCase)){throw 'DeliveryRoot must be under C:\laragon\www'}
if(-not(Test-Path -LiteralPath (Join-Path $repoRoot '.git'))){throw 'Run from a Git checkout'}
$source=Join-Path $delivery 'source-code'
$zip=Join-Path $delivery 'DunnioInsights-1.5.0-macos-source.zip'
if(Test-Path -LiteralPath $source){throw 'source-code already exists; choose a clean delivery folder or move the existing export first'}
if(Test-Path -LiteralPath $zip){throw 'Source ZIP already exists; choose a clean delivery folder or move the existing archive first'}
New-Item -ItemType Directory -Path $delivery -Force | Out-Null
$commit=(git -C $repoRoot rev-parse HEAD).Trim()
if($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$'){throw 'Cannot resolve Git commit'}
$tracked=@(git -C $repoRoot ls-files)
if($LASTEXITCODE -ne 0 -or -not $tracked.Count){throw 'Cannot enumerate tracked source'}
git -C $repoRoot archive --format=zip --prefix=source-code/ --output=$zip $commit
if($LASTEXITCODE -ne 0 -or -not(Test-Path -LiteralPath $zip)){throw 'git archive failed'}
Expand-Archive -LiteralPath $zip -DestinationPath $delivery
Copy-Item -LiteralPath (Join-Path $repoRoot 'desktop\macos\DELIVERY-README.md') -Destination (Join-Path $delivery 'README.md') -Force
$hash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
($hash+'  '+[IO.Path]::GetFileName($zip)) | Set-Content -LiteralPath (Join-Path $delivery 'SOURCE-SHA256.txt') -Encoding ascii
$manifest=[ordered]@{
    product='Dunnio Insights'
    version='1.5.0'
    repository='https://github.com/tahieu98/dunnio-user-behavior-tracker.git'
    commit=$commit
    generatedAt=(Get-Date).ToUniversalTime().ToString('o')
    trackedFiles=$tracked.Count
    sourceArchive=[IO.Path]::GetFileName($zip)
    sourceArchiveSha256=$hash
    sourceDirectory='source-code'
    installers=@('DunnioInsights-1.5.0-macos-arm64.dmg','DunnioInsights-1.5.0-macos-x64.dmg')
    excluded=@('.git','node_modules','.local','dist','.env (except examples)','settings.protected','settings.keychain','database and user files','backups','signing credentials')
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $delivery 'SOURCE-MANIFEST.json') -Encoding utf8
Write-Output ($manifest | ConvertTo-Json -Depth 5)
