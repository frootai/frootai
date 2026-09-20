[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^https://[^/?#@]+$')]
    [string] $Url,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._()-]{1,90}$')]
    [string] $ExportName,

    [ValidatePattern('^[a-z0-9-]{3,64}$')]
    [string] $ScopeAlias = 'solution-scope',

    [switch] $SkipExport,
    [switch] $SkipBurst
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    Write-Host '== 1/3 Refreshing approved cost evidence' -ForegroundColor Cyan
    $arguments = @('ops/refresh-cost-export.mjs', '--subscription', $SubscriptionId, '--export', $ExportName, '--url', $Url, '--scope', $ScopeAlias, '--period', 'mtd')
    if ($SkipExport) { $arguments += @('--skip-export', 'true') }
    & node @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Evidence refresh failed. The previous validated snapshot remains available.' }

    Write-Host '== 2/3 Reading the published total' -ForegroundColor Cyan
    $summary = Invoke-RestMethod "$($Url.TrimEnd('/'))/api/v1/summary?scope=$ScopeAlias&period=mtd" -TimeoutSec 30
    Write-Host ("Total: {0:N2} {1}" -f [decimal]$summary.totalCost.amount, $summary.totalCost.currency) -ForegroundColor Green
    Write-Host "Period: $($summary.periodLabel)"
    Write-Host "Status: $($summary.status)"
    Write-Host "Collected: $($summary.collectedAt)"
    Write-Host 'Compare this value with Cost Management using the same subscription, dates, Actual cost basis, currency, and collection time.' -ForegroundColor Yellow
    if ($summary.status -ne 'fresh') { throw "The snapshot is $($summary.status), not fresh." }

    if (-not $SkipBurst) {
        Write-Host '== 3/3 Running the ten-question stability pass' -ForegroundColor Cyan
        & node ops/stability-burst.mjs --url $Url --scope $ScopeAlias --period mtd --rounds 1
        if ($LASTEXITCODE -ne 0) { throw 'At least one response would show an incomplete alert.' }
    } else {
        Write-Host '== 3/3 Stability pass skipped by operator' -ForegroundColor Yellow
    }
    Write-Host 'READY. Evidence is fresh and the selected checks passed.' -ForegroundColor Green
}
finally { Pop-Location }
