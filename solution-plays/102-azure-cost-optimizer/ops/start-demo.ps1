[CmdletBinding()]
param(
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [ValidateSet('foundry', 'azure-openai', 'none')]
    [string] $Provider,

    [ValidatePattern('^https://[^/?#@]+/api/projects/[A-Za-z0-9._-]+/?$')]
    [string] $FoundryProjectEndpoint,

    [ValidatePattern('^https://[^/?#@]+/?$')]
    [string] $AzureOpenAIEndpoint,

    [ValidateSet('identity', 'api-key')]
    [string] $AzureOpenAIAuthMode,

    [ValidateSet('query', 'cost-details')]
    [string] $CostSource = 'query',

    [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')]
    [string] $ModelDeploymentName,

    [ValidateRange(1024, 65535)]
    [int] $Port = 8080,

    [switch] $Rebuild,
    [switch] $CheckOnly
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repositoryRoot 'src\AzureCostOptimizer.Web'
$appContentRoot = Join-Path $repositoryRoot 'src\AzureCostOptimizer.App'
$appProject = Join-Path $appContentRoot 'AzureCostOptimizer.App.csproj'
$publishedAssembly = Join-Path $repositoryRoot 'AzureCostOptimizer.App.dll'
$isPublishedPackage = Test-Path $publishedAssembly -PathType Leaf
$appAssembly = Join-Path $appContentRoot 'bin\Release\net10.0\AzureCostOptimizer.App.dll'
if ($isPublishedPackage) {
    $appContentRoot = $repositoryRoot
    $appAssembly = $publishedAssembly
    if ($Rebuild) { throw 'A published package cannot be rebuilt. Use the source repository for -Rebuild.' }
}
$staticIndex = Join-Path $appContentRoot 'wwwroot\index.html'
$bundledPrompt = Join-Path (Split-Path -Parent $appAssembly) 'aco-system-prompt.md'

function Assert-Command {
    param([Parameter(Mandatory)] [string] $Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not installed or is not on PATH."
    }
}

function Invoke-AzureJson {
    param([Parameter(Mandatory)] [string[]] $Arguments)

    $output = & az @Arguments --only-show-errors 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI read failed. Confirm that you are signed in and can access the selected subscription."
    }
    try {
        return $output | ConvertFrom-Json -ErrorAction Stop
    } catch {
        throw 'Azure CLI returned an unreadable response.'
    }
}

function Select-EnabledSubscription {
    param([string] $RequestedSubscriptionId)

    $subscriptionPayload = Invoke-AzureJson -Arguments @('account', 'list', '--all', '--output', 'json')
    $subscriptions = @(
        foreach ($candidate in $subscriptionPayload) {
            if ($candidate.state -eq 'Enabled') { $candidate }
        }
    ) | Sort-Object name
    if ($subscriptions.Count -eq 0) {
        throw 'No enabled Azure subscriptions are available to the signed-in Azure CLI account.'
    }

    if ($RequestedSubscriptionId) {
        $selected = @($subscriptions | Where-Object { $_.id -eq $RequestedSubscriptionId })
        if ($selected.Count -ne 1) {
            throw 'The requested subscription is not enabled or is not available to this Azure CLI account.'
        }
        return $selected[0]
    }

    Write-Host ''
    Write-Host 'Select the Azure subscription to analyze. The CLI default will not be changed.'
    for ($index = 0; $index -lt $subscriptions.Count; $index++) {
        Write-Host ("  [{0}] {1} ({2})" -f ($index + 1), $subscriptions[$index].name, $subscriptions[$index].id)
    }
    $selection = Read-Host "Enter 1-$($subscriptions.Count)"
    $selectedIndex = 0
    if (-not [int]::TryParse($selection, [ref] $selectedIndex) -or $selectedIndex -lt 1 -or $selectedIndex -gt $subscriptions.Count) {
        throw 'Subscription selection was not valid.'
    }
    return $subscriptions[$selectedIndex - 1]
}

Assert-Command -Name 'az'
Assert-Command -Name 'dotnet'

$runtimes = @(& dotnet --list-runtimes)
if ($LASTEXITCODE -ne 0 -or -not ($runtimes -match '^Microsoft.AspNetCore.App 10\.')) {
    throw 'The .NET 10 ASP.NET Core runtime is required. An SDK is needed only to build from source.'
}

$subscription = Select-EnabledSubscription -RequestedSubscriptionId $SubscriptionId
$SubscriptionId = $subscription.id
$tenantId = $subscription.tenantId

$resourceGroups = @(Invoke-AzureJson -Arguments @('group', 'list', '--subscription', $SubscriptionId, '--output', 'json'))
$resourceGroupCount = @($resourceGroups | ForEach-Object { $_ }).Count

if (-not $Provider -and $env:ACI_AI_PROVIDER) { $Provider = $env:ACI_AI_PROVIDER }
if (-not $Provider) {
    Write-Host ''
    Write-Host 'Choose the intelligence provider:'
    Write-Host '  [1] Existing Microsoft Foundry project (Azure identity)'
    Write-Host '  [2] Existing Azure OpenAI deployment (Azure identity)'
    Write-Host '  [3] Existing Azure OpenAI deployment (API key from process environment)'
    Write-Host '  [4] Cost-only (no model calls)'
    switch (Read-Host 'Enter 1-4') {
        '1' { $Provider = 'foundry' }
        '2' { $Provider = 'azure-openai'; $AzureOpenAIAuthMode = 'identity' }
        '3' { $Provider = 'azure-openai'; $AzureOpenAIAuthMode = 'api-key' }
        '4' { $Provider = 'none' }
        default { throw 'Provider selection was not valid.' }
    }
}
$Provider = $Provider.Trim().ToLowerInvariant()
if ($Provider -notin @('foundry', 'azure-openai', 'none')) {
    throw 'ACI_AI_PROVIDER must be foundry, azure-openai, or none.'
}

$selectedEndpoint = $null
$authentication = 'none'
if ($Provider -eq 'foundry') {
    if (-not $FoundryProjectEndpoint -and $env:AZURE_AI_PROJECT_ENDPOINT) { $FoundryProjectEndpoint = $env:AZURE_AI_PROJECT_ENDPOINT }
    if (-not $ModelDeploymentName -and $env:AZURE_AI_MODEL_DEPLOYMENT_NAME) { $ModelDeploymentName = $env:AZURE_AI_MODEL_DEPLOYMENT_NAME }
    if (-not $FoundryProjectEndpoint) { $FoundryProjectEndpoint = Read-Host 'Existing Microsoft Foundry project endpoint' }
    $selectedEndpoint = $FoundryProjectEndpoint
    $authentication = 'identity'
} elseif ($Provider -eq 'azure-openai') {
    if (-not $AzureOpenAIEndpoint -and $env:AZURE_OPENAI_ENDPOINT) { $AzureOpenAIEndpoint = $env:AZURE_OPENAI_ENDPOINT }
    if (-not $ModelDeploymentName -and $env:AZURE_OPENAI_DEPLOYMENT_NAME) { $ModelDeploymentName = $env:AZURE_OPENAI_DEPLOYMENT_NAME }
    if (-not $AzureOpenAIAuthMode -and $env:AZURE_OPENAI_AUTH_MODE) { $AzureOpenAIAuthMode = $env:AZURE_OPENAI_AUTH_MODE }
    if (-not $AzureOpenAIAuthMode) { $AzureOpenAIAuthMode = 'identity' }
    $AzureOpenAIAuthMode = $AzureOpenAIAuthMode.Trim().ToLowerInvariant()
    if ($AzureOpenAIAuthMode -notin @('identity', 'api-key')) {
        throw 'AZURE_OPENAI_AUTH_MODE must be identity or api-key.'
    }
    if ($AzureOpenAIAuthMode -eq 'api-key' -and [string]::IsNullOrWhiteSpace($env:AZURE_OPENAI_API_KEY)) {
        throw 'Supply AZURE_OPENAI_API_KEY through the process environment or a secret manager before launch. Never use a command-line argument or paste it into chat.'
    }
    if (-not $AzureOpenAIEndpoint) { $AzureOpenAIEndpoint = Read-Host 'Existing Azure OpenAI resource root endpoint' }
    $selectedEndpoint = $AzureOpenAIEndpoint
    $authentication = $AzureOpenAIAuthMode
}

if ($Provider -ne 'none') {
    if (-not $ModelDeploymentName) { $ModelDeploymentName = Read-Host 'Existing model deployment name' }
    $endpointUri = $null
    if (-not [Uri]::TryCreate($selectedEndpoint, [UriKind]::Absolute, [ref] $endpointUri) -or
        $endpointUri.Scheme -ne 'https' -or $endpointUri.UserInfo -or $endpointUri.Query -or $endpointUri.Fragment) {
        throw 'The model endpoint must be HTTPS without embedded credentials, query parameters, or a fragment.'
    }
    if ($Provider -eq 'foundry' -and $endpointUri.AbsolutePath -notmatch '^/api/projects/[A-Za-z0-9._-]+/?$') {
        throw 'The Foundry project endpoint must end with /api/projects/<project-name>.'
    }
    if ($Provider -eq 'azure-openai' -and $endpointUri.AbsolutePath -ne '/') {
        throw 'Use the Azure OpenAI resource root endpoint, not a project, deployment, or chat-completions URL.'
    }
    if ($ModelDeploymentName -notmatch '^[A-Za-z0-9._-]{1,64}$') {
        throw 'The model deployment name is not valid.'
    }
}

$receipt = [ordered]@{
    status = 'configuration-checked'
    mode = "local-$Provider"
    intelligenceProvider = $Provider
    authentication = $authentication
    modelAccess = $(if ($Provider -eq 'none') { 'disabled' } else { 'not-tested' })
    subscriptionName = $subscription.name
    subscriptionId = $SubscriptionId
    tenantId = $tenantId
    resourceGroupReadCount = [int] $resourceGroupCount
    modelEndpoint = $selectedEndpoint
    modelDeploymentName = $(if ($Provider -ne 'none') { $ModelDeploymentName } else { $null })
    publishedPackage = [bool] $isPublishedPackage
    bundleReady = [bool] ((Test-Path $appAssembly) -and (Test-Path $staticIndex) -and (Test-Path $bundledPrompt))
    url = "http://127.0.0.1:$Port"
    azureCliDefaultChanged = $false
    cloudResourcesCreated = $false
}

if ($CheckOnly) {
    $receipt | ConvertTo-Json -Depth 3
    return
}

if (-not $Rebuild -and -not $receipt.bundleReady) {
    throw 'The supplied application, frontend or prompt is missing. Obtain complete artifacts, or explicitly approve source maintenance and use -Rebuild. No build was started.'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
} catch [System.Net.Sockets.SocketException] {
    throw "Port $Port is unavailable. Select another port with -Port."
} finally {
    $listener.Stop()
}

Push-Location $repositoryRoot
try {
    if ($isPublishedPackage -and -not (Test-Path $staticIndex)) {
        throw 'The published package is missing dashboard assets. Obtain a complete package; no frontend rebuild is attempted.'
    }
    if (-not $isPublishedPackage -and $Rebuild) {
        Assert-Command -Name 'node'
        Assert-Command -Name 'npm'
        $nodeVersion = (& node --version).Trim().TrimStart('v')
        if ([version] $nodeVersion -lt [version] '24.0.0') { throw 'Node.js 24 or newer is required only for a frontend rebuild.' }
        Push-Location $webRoot
        try {
            if (-not (Test-Path (Join-Path $webRoot 'node_modules'))) {
                & npm ci
                if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency restore failed.' }
            }
            & npm run build
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
        } finally {
            Pop-Location
        }
    }

    if (-not $isPublishedPackage -and $Rebuild) {
        $dotnetVersion = (& dotnet --version).Trim()
        if ($LASTEXITCODE -ne 0 -or [version] ($dotnetVersion -split '-')[0] -lt [version] '10.0.0') {
            throw 'The .NET 10 SDK is required to build from source.'
        }
        & dotnet restore $appProject --locked-mode
        if ($LASTEXITCODE -ne 0) { throw 'Application restore failed.' }
        & dotnet build $appProject --configuration Release --no-restore
        if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
    }
    if ($Provider -ne 'none' -and -not (Test-Path $bundledPrompt)) {
        throw 'The bundled ACO prompt is missing. Obtain a complete package or use -Provider none for cost-only mode.'
    }

    $launchEnvironment = [ordered]@{
        ACI_SUBSCRIPTION_ID = $SubscriptionId
        ACI_TENANT_ID = $tenantId
        ACI_HOSTING_PROFILE = 'local'
        ACI_DATA_PROFILE = 'live'
        ACI_AUTO_REFRESH = 'false'
        ACI_EXTENDED_COLLECTION_ENABLED = 'false'
        ACI_COST_SOURCE = $CostSource
        ACI_AI_PROVIDER = $Provider
        AZURE_AI_PROJECT_ENDPOINT = $(if ($Provider -eq 'foundry') { $FoundryProjectEndpoint } else { $null })
        AZURE_AI_MODEL_DEPLOYMENT_NAME = $(if ($Provider -eq 'foundry') { $ModelDeploymentName } else { $null })
        AZURE_OPENAI_ENDPOINT = $(if ($Provider -eq 'azure-openai') { $AzureOpenAIEndpoint } else { $null })
        AZURE_OPENAI_DEPLOYMENT_NAME = $(if ($Provider -eq 'azure-openai') { $ModelDeploymentName } else { $null })
        AZURE_OPENAI_AUTH_MODE = $(if ($Provider -eq 'azure-openai') { $AzureOpenAIAuthMode } else { $null })
    }
    $previousEnvironment = @{}
    foreach ($name in $launchEnvironment.Keys) {
        $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    try {
        foreach ($name in $launchEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable($name, $launchEnvironment[$name], 'Process')
        }

        Write-Host ''
        Write-Host "ACO Demo v1 is starting at http://127.0.0.1:$Port"
        Write-Host "Subscription: $($subscription.name)"
        Write-Host "Intelligence provider: $Provider ($authentication)"
        Write-Host "Cost source: $CostSource. Collection starts only after an explicit refresh."
        Write-Host 'Model access has not been tested. Use Ask ACO only when ready to permit inference.'
        Write-Host 'Press Ctrl+C to stop. No Azure resources will be created or changed.'
        & dotnet $appAssembly --contentRoot $appContentRoot --urls "http://127.0.0.1:$Port"
        if ($LASTEXITCODE -ne 0) { throw "ACO Demo v1 exited with code $LASTEXITCODE." }
    } finally {
        foreach ($name in $previousEnvironment.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
        }
    }
} finally {
    Pop-Location
}