[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Plan', 'Apply', 'Rollback')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._()-]{1,90}$')]
    [string] $ResourceGroupName,

    [string] $ParametersFile,
    [string] $PreviousImageDigest
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $root '.solution'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$template = Join-Path $root 'infra\main.bicep'
$whatIf = Join-Path $stateRoot 'app-what-if.json'
$receipt = Join-Path $stateRoot 'app-deployment.json'
$deploymentName = 'aco-solution-application'
$isRollback = $Stage -eq 'Rollback'

if (-not $ParametersFile) { $ParametersFile = Join-Path $stateRoot 'app.parameters.json' }
$ParametersFile = [IO.Path]::GetFullPath($ParametersFile)
if (-not (Test-Path $ParametersFile)) { throw "Parameters file not found: $ParametersFile. Copy infra/solution.parameters.example.json into .solution and replace every placeholder privately." }
$parameters = Get-Content -LiteralPath $ParametersFile -Raw | ConvertFrom-Json
$image = $parameters.parameters.containerImage.value
if ($image -notmatch '^[a-z0-9.-]+\.azurecr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$') { throw 'containerImage must be an immutable ACR digest.' }
if ($parameters.parameters.authMode.value -eq 'container-apps-easy-auth') {
    foreach ($name in @('tenantId', 'entraClientId', 'entraAudience', 'entraClientSecret')) {
        $value = $parameters.parameters.$name.value
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^<.+>$') { throw "Authenticated hosting requires a real private value for $name." }
    }
}

if ($Stage -eq 'Rollback') {
    if ($PreviousImageDigest -notmatch '^[a-z0-9.-]+\.azurecr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$') { throw 'Rollback requires -PreviousImageDigest as an immutable ACR image.' }
    $parameters.parameters.containerImage.value = $PreviousImageDigest
    $ParametersFile = Join-Path $stateRoot 'rollback.parameters.json'
    $parameters | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ParametersFile -Encoding UTF8
    $Stage = 'Plan'
    $whatIf = Join-Path $stateRoot 'rollback-what-if.json'
    $receipt = Join-Path $stateRoot 'rollback-deployment.json'
}

if ($Stage -eq 'Plan') {
    $raw = & az deployment group what-if --subscription $SubscriptionId --resource-group $ResourceGroupName --name $deploymentName --template-file $template --parameters "@$ParametersFile" --no-pretty-print --output json --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw 'Application what-if failed.' }
    $plan = $raw | ConvertFrom-Json
    $safe = [ordered]@{
        status = $plan.status
        image = $parameters.parameters.containerImage.value
        changes = @($plan.changes | ForEach-Object { [ordered]@{ changeType = $_.changeType; resourceId = $_.resourceId; unsupportedReason = $_.unsupportedReason } })
    }
    $safe | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $whatIf -Encoding UTF8
    $safe | ConvertTo-Json -Depth 8
    Write-Host "Review $whatIf. Apply only when every change is expected."
    if (-not $isRollback) { return }
}

if (-not (Test-Path $whatIf)) { throw 'Run Stage Plan first.' }
$reviewed = Get-Content -LiteralPath $whatIf -Raw | ConvertFrom-Json
if ($reviewed.status -ne 'Succeeded' -or @($reviewed.changes | Where-Object { $_.changeType -in @('Delete', 'Unsupported') }).Count -gt 0) { throw 'The saved what-if is not safe to apply.' }
$raw = & az deployment group create --subscription $SubscriptionId --resource-group $ResourceGroupName --name $deploymentName --template-file $template --parameters "@$ParametersFile" --mode Incremental --query properties.outputs --output json --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Application deployment failed.' }
$outputs = $raw | ConvertFrom-Json
$result = [ordered]@{
    deployedAt = (Get-Date).ToUniversalTime().ToString('o')
    image = $parameters.parameters.containerImage.value
    applicationUrl = $outputs.applicationUrl.value
    containerAppName = $outputs.containerAppName.value
    previousImageRequiredForRollback = $true
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receipt -Encoding UTF8
$result | ConvertTo-Json -Depth 6
