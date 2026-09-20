[CmdletBinding()]
param(
    [ValidateSet('Local', 'Azure', 'Foundry')]
    [string] $Track = 'Local'
)

$ErrorActionPreference = 'Stop'

function Get-Version([string] $Command, [string[]] $Arguments) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { return $null }
    try {
        $value = (& $Command @Arguments 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { return $null }
        return $value
    }
    catch { return $null }
}

$checks = [ordered]@{
    dotnet = Get-Version 'dotnet' @('--version')
    node = Get-Version 'node' @('--version')
    npm = Get-Version 'npm' @('--version')
    powershell = $PSVersionTable.PSVersion.ToString()
}

if ($Track -in @('Azure', 'Foundry')) {
    $checks.azureCli = Get-Version 'az' @('version', '--query', '"azure-cli"', '--output', 'tsv')
    $checks.bicep = Get-Version 'az' @('bicep', 'version')
    $checks.acrRemoteBuild = if ($checks.azureCli) {
        $help = (& az acr build --help 2>$null | Out-String)
        if ($LASTEXITCODE -eq 0 -and $help -match 'az acr build') { 'available' } else { $null }
    } else { $null }
}

if ($Track -eq 'Foundry') {
    $checks.foundryConfiguration = if ($env:AZURE_AI_PROJECT_ENDPOINT -and $env:AZURE_AI_MODEL_DEPLOYMENT_NAME) {
        'configured endpoint and deployment'
    } else {
        'configure after model selection'
    }
}

$minimums = [ordered]@{
    dotnet = '10.0.0'
    node = '24.0.0'
}
$issues = @()
if ($checks.dotnet -and [version](($checks.dotnet -split '-')[0]) -lt [version]$minimums.dotnet) { $issues += ".NET SDK $($minimums.dotnet)+ required" }
if ($checks.node) {
    $nodeVersion = $checks.node.TrimStart('v')
    if ([version](($nodeVersion -split '-')[0]) -lt [version]$minimums.node) { $issues += "Node.js $($minimums.node)+ required" }
}
$missing = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object Key)

$result = [ordered]@{
    schemaVersion = '1.0.0'
    track = $Track
    status = if ($missing.Count -eq 0 -and $issues.Count -eq 0) { 'ready' } else { 'action-required' }
    capabilities = $checks
    missing = $missing
    issues = $issues
    dockerRequired = $false
    changedMachine = $false
    changedAzure = $false
}
$result | ConvertTo-Json -Depth 5
if ($result.status -ne 'ready') {
    Write-Error 'Install or configure the listed prerequisites using your organization-approved process, then rerun the doctor. This script installs nothing.'
}
