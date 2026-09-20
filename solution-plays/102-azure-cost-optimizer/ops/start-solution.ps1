[CmdletBinding()]
param(
    [ValidateSet('Sample', 'Live')]
    [string] $Mode = 'Sample',

    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [ValidateSet('Foundry', 'AzureOpenAI', 'None')]
    [string] $Provider = 'None',

    [ValidateSet('Query', 'CostDetails')]
    [string] $CostSource = 'Query',

    [string] $FoundryProjectEndpoint,
    [string] $AzureOpenAIEndpoint,
    [string] $ModelDeploymentName,

    [ValidateRange(1024, 65535)]
    [int] $Port = 8080,

    [switch] $CheckOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $root 'src\AzureCostOptimizer.App'
$app = Join-Path $appRoot 'bin\Release\net10.0\AzureCostOptimizer.App.dll'
if (-not (Test-Path $app)) {
    throw "The Release build is missing. Run 'npm run restore:backend' and 'npm run build:backend' from the solution root."
}

if ($Mode -eq 'Live') {
    if (-not $SubscriptionId) { throw 'Live mode requires -SubscriptionId.' }
    $providerValue = switch ($Provider) { 'Foundry' { 'foundry' } 'AzureOpenAI' { 'azure-openai' } default { 'none' } }
    $sourceValue = if ($CostSource -eq 'CostDetails') { 'cost-details' } else { 'query' }
    $arguments = @(
        '-SubscriptionId', $SubscriptionId,
        '-Provider', $providerValue,
        '-CostSource', $sourceValue,
        '-Port', $Port
    )
    if ($FoundryProjectEndpoint) { $arguments += @('-FoundryProjectEndpoint', $FoundryProjectEndpoint) }
    if ($AzureOpenAIEndpoint) { $arguments += @('-AzureOpenAIEndpoint', $AzureOpenAIEndpoint) }
    if ($ModelDeploymentName) { $arguments += @('-ModelDeploymentName', $ModelDeploymentName) }
    if ($CheckOnly) { $arguments += '-CheckOnly' }
    & (Join-Path $PSScriptRoot 'start-demo.ps1') @arguments
    exit $LASTEXITCODE
}

if ($CheckOnly) {
    [ordered]@{
        status = 'configuration-checked'
        mode = 'sample'
        providerCalls = 0
        modelCalls = 0
        bundleReady = $true
        url = "http://127.0.0.1:$Port"
    } | ConvertTo-Json
    return
}

$previous = @{}
$values = [ordered]@{
    ACI_HOSTING_PROFILE = 'local'
    ACI_DATA_PROFILE = 'solution_snapshot'
    ACI_AI_PROVIDER = 'none'
    ACI_AUTO_REFRESH = 'false'
    ACI_MCP_ENABLED = 'false'
}
foreach ($name in $values.Keys) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $values[$name], 'Process')
}
try {
    Write-Host "Azure Cost Optimizer sample is starting at http://127.0.0.1:$Port"
    Write-Host 'No Azure provider or model calls are enabled. Press Ctrl+C to stop.'
    & dotnet $app --contentRoot $appRoot --urls "http://127.0.0.1:$Port"
    if ($LASTEXITCODE -ne 0) { throw "Azure Cost Optimizer exited with code $LASTEXITCODE." }
}
finally {
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
