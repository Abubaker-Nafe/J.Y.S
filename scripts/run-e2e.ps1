param(
  [ValidateSet("storefront", "database", "hosts")]
  [string]$Suite = "storefront"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resultDirectory = Join-Path $projectRoot "test-results"
New-Item -ItemType Directory -Path $resultDirectory -Force | Out-Null
$serverOutput = Join-Path $resultDirectory "webserver-$Suite.out.log"
$serverError = Join-Path $resultDirectory "webserver-$Suite.err.log"

if ($Suite -eq "storefront") {
  $env:E2E_DEMO_CATALOG = "true"
  Remove-Item Env:E2E_DATABASE_READY -ErrorAction SilentlyContinue
} else {
  Remove-Item Env:E2E_DEMO_CATALOG -ErrorAction SilentlyContinue
  $env:E2E_DATABASE_READY = "true"
}
$env:E2E_RUN_ID = "e2e-$Suite-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$PID"
$env:PLAYWRIGHT_EXTERNAL_SERVER = "true"

$server = $null
$exitCode = 1
try {
  $server = Start-Process `
    -FilePath "node.exe" `
    -ArgumentList @("node_modules/next/dist/bin/next", "dev") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $serverOutput `
    -RedirectStandardError $serverError `
    -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    if ($server.HasExited) {
      throw "Next.js exited before becoming ready. See $serverError."
    }
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3000/en" -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $ready) {
    throw "Next.js did not become ready within 60 seconds. See $serverError."
  }

  if ($Suite -eq "database") {
    & npx.cmd playwright test e2e/database.spec.ts --project=chromium --project=mobile --workers=1
  } elseif ($Suite -eq "hosts") {
    $localAddresses = [System.Net.Dns]::GetHostAddresses("jys.com") | ForEach-Object { $_.ToString() }
    if ($localAddresses -notcontains "127.0.0.1" -and $localAddresses -notcontains "::1") {
      throw "jys.com must resolve to 127.0.0.1 or ::1 before the hosts-file suite can run."
    }
    & npx.cmd playwright test e2e/local-hosts.spec.ts --project=chromium --workers=1
  } else {
    & npx.cmd playwright test e2e/storefront.spec.ts
  }
  $exitCode = $LASTEXITCODE
} finally {
  if ($null -ne $server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    $server.WaitForExit(5000) | Out-Null
  }
  Remove-Item Env:PLAYWRIGHT_EXTERNAL_SERVER -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_DEMO_CATALOG -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_DATABASE_READY -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_RUN_ID -ErrorAction SilentlyContinue
}

exit $exitCode
