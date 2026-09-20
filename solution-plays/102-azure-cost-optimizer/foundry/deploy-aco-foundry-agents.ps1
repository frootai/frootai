[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OpenApiAgent', 'McpAgent', 'All')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._()-]{1,90}$')]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9-]{2,64}$')]
    [string] $AccountName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')]
    [string] $ProjectName,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')]
    [string] $ModelDeploymentName,

    [Parameter(Mandatory)]
    [ValidatePattern('^https://[a-z0-9.-]+\.azurecontainerapps\.io$')]
    [string] $ApplicationUrl,

    [string] $OpenApiAgentName = 'aco-agent-openapi',
    [string] $McpAgentName = 'aco-agent-mcp',
    [switch] $AllowAnonymousDemo
)

$ErrorActionPreference = 'Stop'
if (-not $AllowAnonymousDemo) {
    throw 'This automation supports only an explicitly approved anonymous solution tool profile. For authenticated tools, create approved Foundry connections and configure them in Foundry Playground.'
}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectEndpoint = "https://$AccountName.services.ai.azure.com/api/projects/$ProjectName"
$instructions = Get-Content -LiteralPath (Join-Path $root 'aco-agent-instructions.md') -Raw
$spec = Get-Content -LiteralPath (Join-Path $root 'aco-openapi-tool.v1.json') -Raw
$spec = $spec.Replace('https://{{APPLICATION_HOST}}', $ApplicationUrl) | ConvertFrom-Json

$config = Invoke-RestMethod "$ApplicationUrl/auth/config" -TimeoutSec 30
if ($config.signInRequired) { throw 'The hosted app requires sign-in. Do not use anonymous agent automation; configure authenticated Foundry connections instead.' }

function Invoke-AiRest([string] $Method, [string] $Url, [object] $Body) {
    $temporary = $null
    try {
        $arguments = @('rest', '--subscription', $SubscriptionId, '--method', $Method, '--url', $Url, '--resource', 'https://ai.azure.com', '--only-show-errors')
        if ($null -ne $Body) {
            $temporary = Join-Path $env:TEMP ("aco-foundry-" + [guid]::NewGuid().ToString('N') + '.json')
            $Body | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $temporary -Encoding UTF8
            $arguments += @('--headers', 'Content-Type=application/json', '--body', "@$temporary")
        }
        $raw = & az @arguments 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) { throw "Foundry request failed: HTTP operation $Method." }
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return $raw | ConvertFrom-Json
    }
    finally {
        if ($temporary) { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
    }
}

$results = [ordered]@{ projectEndpoint = $projectEndpoint; applicationUrl = $ApplicationUrl; anonymousDemo = $true }
if ($Stage -in @('OpenApiAgent', 'All')) {
    $response = Invoke-AiRest 'post' "$projectEndpoint/agents?api-version=v1" @{
        name = $OpenApiAgentName
        description = 'Azure Cost Optimizer read-only prompt agent over the bounded OpenAPI evidence surface.'
        definition = @{
            kind = 'prompt'
            model = $ModelDeploymentName
            instructions = $instructions
            tools = @(@{
                type = 'openapi'
                openapi = @{
                    name = 'azure_cost_optimizer'
                    description = 'Read-only evidence from the user Azure Cost Optimizer deployment.'
                    spec = $spec
                    auth = @{ type = 'anonymous' }
                }
            })
        }
    }
    $results.openApiAgent = $response.name
    $results.openApiVersion = $response.versions.latest.version
}
if ($Stage -in @('McpAgent', 'All')) {
    $mcpInstructions = @"
Every tool call must include scope = "solution-scope" and period = "mtd" unless the user explicitly requests 7d, 30d, or 3m.
The tools are read-only. Never claim to mutate Azure. Preserve exact currency and evidence IDs.

"@ + $instructions
    $response = Invoke-AiRest 'post' "$projectEndpoint/agents?api-version=v1" @{
        name = $McpAgentName
        description = 'Azure Cost Optimizer prompt agent over the read-only MCP tool surface.'
        definition = @{
            kind = 'prompt'
            model = $ModelDeploymentName
            instructions = $mcpInstructions
            tools = @(@{
                type = 'mcp'
                server_label = 'azure_cost_optimizer'
                server_url = "$ApplicationUrl/mcp"
                require_approval = 'never'
            })
        }
    }
    $results.mcpAgent = $response.name
    $results.mcpVersion = $response.versions.latest.version
}
$results | ConvertTo-Json -Depth 6
