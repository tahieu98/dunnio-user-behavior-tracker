param([string]$EnvironmentFile,[string]$BackupFolder)
$ErrorActionPreference = 'Stop'
if (-not $EnvironmentFile -or -not (Test-Path -LiteralPath $EnvironmentFile)) { throw 'Provide the external environment file path.' }
$env:DOTENV_CONFIG_PATH = (Resolve-Path -LiteralPath $EnvironmentFile).Path
if ($BackupFolder) { $env:TOUCH_BACKUP_FOLDER = $BackupFolder }
Push-Location (Join-Path $PSScriptRoot '../backend')
try { node scripts/touch-maintenance.js; if ($LASTEXITCODE -ne 0) { throw 'Daily archive failed.' } } finally { Pop-Location }
