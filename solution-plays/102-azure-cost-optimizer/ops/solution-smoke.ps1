[CmdletBinding()]
param(
    [ValidatePattern('^https?://[^/?#@]+$')]
    [string] $Url = $env:ACO_BASE_URL,

    [ValidatePattern('^[a-z0-9-]{3,64}$')]
    [string] $ScopeAlias = 'solution-scope',

    [switch] $IncludeAgent
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Url)) { throw 'Set ACO_BASE_URL to the solution base URL before running this command.' }
$base = $Url.TrimEnd('/')
$checks = @()

function Check([string] $Name, [scriptblock] $Action) {
    try {
        $detail = & $Action
        $script:checks += [ordered]@{ name = $Name; passed = $true; detail = $detail }
    }
    catch {
        $script:checks += [ordered]@{ name = $Name; passed = $false; detail = $_.Exception.Message }
    }
}

Check 'liveness' { (Invoke-RestMethod "$base/health/live" -TimeoutSec 30).status }
Check 'readiness' { (Invoke-RestMethod "$base/health/ready" -TimeoutSec 30).status }
Check 'runtime profile' {
    $config = Invoke-RestMethod "$base/auth/config" -TimeoutSec 30
    "hosted=$($config.hosted) provider=$($config.intelligenceProvider) refreshMinutes=$($config.scheduledRefreshMinutes)"
}
foreach ($period in @('7d', '30d', 'mtd')) {
    Check "summary-$period" {
        $summary = Invoke-RestMethod "$base/api/v1/summary?scope=$ScopeAlias&period=$period" -TimeoutSec 30
        "$($summary.periodLabel) $($summary.totalCost.currency) $([decimal]$summary.totalCost.amount) status=$($summary.status)"
    }
}
Check 'advisor' { "findings=$(@(Invoke-RestMethod "$base/api/v1/advisor?scope=$ScopeAlias&period=mtd" -TimeoutSec 30).Count)" }
Check 'data-health' {
    $health = Invoke-RestMethod "$base/api/v1/data-health?scope=$ScopeAlias&period=mtd" -TimeoutSec 30
    "status=$($health.status) sources=$(@($health.sources).Count) excluded=$($health.excludedRows)"
}

if ($IncludeAgent) {
    Check 'agent-full-review' {
        $body = @{ message = 'Give me a full cost review of this month covering service, resource group, daily trend, Advisor, WAF and FinOps.'; scopeAlias = $ScopeAlias; period = 'mtd'; effort = 'thorough' } | ConvertTo-Json
        $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$base/api/v1/agent/responses/stream" -ContentType 'application/json' -Body $body -TimeoutSec 180
        if ($response.Content -notmatch 'event: done' -or $response.Content -notmatch '"validated":true') { throw 'Agent response was not validated.' }
        'validated SSE response'
    }
}

$failed = @($checks | Where-Object { -not $_.passed })
$result = [ordered]@{ url = $base; passed = $failed.Count -eq 0; checks = $checks }
$result | ConvertTo-Json -Depth 6
if ($failed.Count) { exit 1 }
