[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root 'src\AzureCostOptimizer.Web'
$env:ACO_RESPONSE_DIST = Join-Path $root 'src\AzureCostOptimizer.App\wwwroot'
Push-Location $web
try {
    & npx playwright test tests/dashboard.spec.ts --grep 'response layer \(mocked\)' --project=desktop --project=mobile --workers=1
    if ($LASTEXITCODE -ne 0) { throw "Playwright response tests failed with exit code $LASTEXITCODE." }
}
finally {
    Pop-Location
}
