$ErrorActionPreference = 'Stop'
$trackerEnvPath = Join-Path $env:USERPROFILE '.codex\local-services\dunnio-review\tracker.env'
if (-not (Test-Path -LiteralPath $trackerEnvPath)) { throw 'Local review environment not configured. See README for normal MySQL setup.' }
$env:DOTENV_CONFIG_PATH = $trackerEnvPath
$trackerServiceDir = Split-Path -Parent $trackerEnvPath
$trackerMySqlExe = 'C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysqld.exe'
if (-not (Test-Path -LiteralPath $trackerMySqlExe)) {
    foreach ($trackerVersion in @('1.4.0','1.3.2')) {
        $trackerCandidate=Join-Path $PSScriptRoot "dist/DunnioInsights-$trackerVersion-win-x64/runtime/mysql/bin/mysqld.exe"
        if (Test-Path -LiteralPath $trackerCandidate) { $trackerMySqlExe=$trackerCandidate; break }
    }
}
if (-not (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue)) {
    if (-not (Test-Path -LiteralPath $trackerMySqlExe)) { throw 'MySQL 8.4.3 executable missing; start the isolated database manually.' }
    Start-Process -FilePath $trackerMySqlExe -ArgumentList @('--no-defaults',"--datadir=$trackerServiceDir\mysql-data",'--port=3307','--bind-address=127.0.0.1','--mysqlx=OFF','--skip-log-bin','--console') -WindowStyle Hidden -RedirectStandardOutput "$trackerServiceDir\mysql.stdout.log" -RedirectStandardError "$trackerServiceDir\mysql.stderr.log"
    for ($trackerAttempt = 0; $trackerAttempt -lt 30; $trackerAttempt++) {
        if (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue) { break }
        Start-Sleep -Milliseconds 200
    }
}
Push-Location (Join-Path $PSScriptRoot 'backend')
try { node src/migrate.js; if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }; node src/index.js } finally { Pop-Location }
