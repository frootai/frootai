[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Plan', 'Apply')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._()-]{1,90}$')]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z][a-z0-9-]{2,17}$')]
    [string] $Prefix,

    [Parameter(Mandatory)]
    [string] $Owner,

    [Parameter(Mandatory)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string] $ExpiresOn,

    [ValidatePattern('^[a-z0-9]+$')]
    [string] $Location = 'eastus2',

    [string] $SecurityControl = '',
    [string] $FoundryProjectName = 'aco-solution'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $root '.solution'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$template = Join-Path $root 'infra\demo-foundation.bicep'
$parameters = Join-Path $stateRoot 'foundation.parameters.json'
$whatIf = Join-Path $stateRoot 'infra-what-if.json'
$outputs = Join-Path $stateRoot 'foundation.outputs.json'
$deploymentName = "$Prefix-foundation"

$tags = [ordered]@{
    application = 'azure-cost-optimizer'
    environment = 'solution'
    owner = $Owner
    purpose = 'user-solution'
    'expires-on' = $ExpiresOn
    'managed-by' = 'bicep'
}
if ($SecurityControl) { $tags.SecurityControl = $SecurityControl }

$document = [ordered]@{
    '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters = [ordered]@{
        resourceGroupName = @{ value = $ResourceGroupName }
        location = @{ value = $Location }
        prefix = @{ value = $Prefix }
        foundryProjectName = @{ value = $FoundryProjectName }
        tags = @{ value = $tags }
    }
}
$document | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $parameters -Encoding UTF8

if ($Stage -eq 'Plan') {
    $raw = & az deployment sub what-if --subscription $SubscriptionId --location $Location --name $deploymentName --template-file $template --parameters "@$parameters" --no-pretty-print --output json --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw 'Foundation what-if failed.' }
    $plan = $raw | ConvertFrom-Json
    $safe = [ordered]@{
        status = $plan.status
        changes = @($plan.changes | ForEach-Object { [ordered]@{ changeType = $_.changeType; resourceId = $_.resourceId; unsupportedReason = $_.unsupportedReason } })
    }
    $safe | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $whatIf -Encoding UTF8
    $safe | ConvertTo-Json -Depth 8
    Write-Host "Review $whatIf before Apply. Any unexpected delete, replacement, role, region, or resource blocks apply."
    return
}

if (-not (Test-Path $whatIf)) { throw 'Run Stage Plan first.' }
$reviewed = Get-Content -LiteralPath $whatIf -Raw | ConvertFrom-Json
if ($reviewed.status -ne 'Succeeded' -or @($reviewed.changes | Where-Object { $_.changeType -in @('Delete', 'Unsupported') }).Count -gt 0) {
    throw 'The saved what-if is not safe to apply.'
}
$rawOutputs = & az deployment sub create --subscription $SubscriptionId --location $Location --name $deploymentName --template-file $template --parameters "@$parameters" --query properties.outputs --output json --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Foundation deployment failed.' }
$rawOutputs | Set-Content -LiteralPath $outputs -Encoding UTF8
Write-Host "Foundation deployed. Private outputs: $outputs"
