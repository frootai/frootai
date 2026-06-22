---
description: "PowerShell standards — Verb-Noun naming, PascalCase, standard parameters, and error handling patterns."
applyTo: "**/*.ps1"
waf:
  - "operational-excellence"
  - "reliability"
---

# PowerShell — FAI Standards

## Approved Verbs & Naming

Use only approved verbs from `Get-Verb`. Enforce Verb-Noun PascalCase naming.

```powershell
# ✅ Approved verbs
function Get-DeploymentStatus { }
function New-AiSearchIndex { }
function Remove-StalePod { }

# ❌ Unapproved — Fetch-Data (Get-), Create-Index (New-), Delete-Resource (Remove-)
```

## Advanced Functions

Every public function must use `[CmdletBinding()]`, typed `[Parameter()]`, and `[OutputType()]`.

```powershell
function Get-ModelDeployment {
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param(
        [Parameter(Mandatory, Position = 0, ValueFromPipelineByPropertyName)]
        [ValidateNotNullOrEmpty()]
        [string]$ResourceGroupName,

        [Parameter(ValueFromPipelineByPropertyName)]
        [ValidateSet('gpt-4o', 'gpt-4o-mini', 'text-embedding-3-large')]
        [string]$ModelName = 'gpt-4o'
    )
    process {
        [PSCustomObject]@{ ResourceGroup = $ResourceGroupName; Model = $ModelName; Status = 'Deployed' }
    }
}
```

## Error Handling

Set `$ErrorActionPreference = 'Stop'` at script scope. Use `try/catch` with typed exceptions. Always use `-ErrorAction Stop` on cmdlets inside try blocks.

```powershell
$ErrorActionPreference = 'Stop'

function Invoke-SafeDeployment {
    [CmdletBinding()]
    param([string]$Name)
    try {
        $result = New-AzResourceGroupDeployment -Name $Name -ErrorAction Stop
        Write-Output $result
    }
    catch [Microsoft.Azure.Commands.ResourceManager.Cmdlets.SdkModels.PSDeploymentException] {
        Write-Error "Deployment failed: $_"
    }
    catch {
        Write-Error "Unexpected error: $($_.Exception.Message)"
        throw  # Re-throw unknown errors
    }
}
```

## ShouldProcess for Destructive Operations

Functions that modify or remove resources must support `-WhatIf` and `-Confirm`.

```powershell
function Remove-StaleDeployment {
    [CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
    param([Parameter(Mandatory, ValueFromPipeline)][string]$DeploymentId)
    process {
        if ($PSCmdlet.ShouldProcess($DeploymentId, 'Remove deployment')) {
            Remove-AzResourceGroupDeployment -Id $DeploymentId -ErrorAction Stop
        }
    }
}
```

## Credential Handling & Splatting

Never store credentials as plaintext. Use `[PSCredential]` params or Key Vault. Use splatting for 3+ params. Prefer `Invoke-RestMethod` over `Invoke-WebRequest` for JSON APIs.

```powershell
# ✅ Credential parameter + Key Vault
param(
    [Parameter(Mandatory)]
    [System.Management.Automation.PSCredential]
    [System.Management.Automation.Credential()]
    $Credential
)
$secret = Get-AzKeyVaultSecret -VaultName 'kv-prod' -Name 'api-key' -AsPlainText

# ✅ Splatting for readability
$params = @{
    Uri         = 'https://api.openai.com/v1/chat/completions'
    Method      = 'POST'
    Headers     = @{ Authorization = "Bearer $token" }
    Body        = $payload | ConvertTo-Json -Depth 10
    ContentType = 'application/json'
}
$response = Invoke-RestMethod @params
```

## Module Structure & Help

One function per file. Export only `Public/` functions. Every exported function needs `.SYNOPSIS`, `.PARAMETER`, `.EXAMPLE`.

```powershell
# MyModule.psm1 — dot-source Public/ and Private/, export only Public
$Public  = @(Get-ChildItem -Path "$PSScriptRoot/Public/*.ps1" -ErrorAction SilentlyContinue)
$Private = @(Get-ChildItem -Path "$PSScriptRoot/Private/*.ps1" -ErrorAction SilentlyContinue)
foreach ($file in @($Public + $Private)) { . $file.FullName }
Export-ModuleMember -Function $Public.BaseName

function Get-TokenUsage {
    <#
    .SYNOPSIS
        Retrieves token usage metrics for an Azure OpenAI deployment.
    .EXAMPLE
        Get-TokenUsage -DeploymentName 'gpt4o-prod' | Format-Table
    #>
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param([Parameter(Mandatory)][string]$DeploymentName)
    # ...
}
```

## Pester Integration

Mock external dependencies. Use `-Scope Context` for invocations called in `BeforeAll`.

```powershell
Describe 'Get-ModelDeployment' {
    BeforeAll {
        Mock Get-AzCognitiveServicesAccountDeployment { @{ Name = 'gpt4o'; State = 'Succeeded' } }
        $result = Get-ModelDeployment -ResourceGroupName 'rg-ai'
    }
    It 'returns correct name' { $result.Name | Should -Be 'gpt4o' }
    It 'calls API once' { Should -Invoke Get-AzCognitiveServicesAccountDeployment -Times 1 -Scope Context }
}
```

## PSScriptAnalyzer

Run `Invoke-ScriptAnalyzer -Recurse -Path ./src` in CI. Enforce these rules:

- `PSAvoidUsingPlainTextForPassword` — no plaintext secrets
- `PSUseShouldProcessForStateChangingFunctions` — destructive ops need WhatIf
- `PSUseApprovedVerbs` — only Get-Verb approved verbs
- `PSAvoidGlobalVars` — no `$global:` scope pollution
- `PSUsePSCredentialType` — credential params must be PSCredential

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| `Write-Host` for output | Use `Write-Output` or return objects; `Write-Host` bypasses pipeline |
| Backtick line continuation | Use splatting or pipeline operators instead |
| `Invoke-Expression` with user input | Parse/validate input explicitly — injection risk |
| Raw `try {} catch { $_ }` swallowing | Always log or re-throw — silent failures kill reliability |
| `[string]$Password` parameter | Use `[SecureString]` or `[PSCredential]` |
| `Select-Object *` in production | Select specific properties — reduces memory and data leakage |

## WAF Alignment

| Pillar | PowerShell Practice |
|---|---|
| **Reliability** | `$ErrorActionPreference = 'Stop'`, typed catch blocks, retry logic with exponential backoff |
| **Security** | PSCredential params, Key Vault secrets, no `Invoke-Expression`, ScriptAnalyzer in CI |
| **Cost Optimization** | Filter left with `-Filter` params at source, avoid `Get-* | Where-Object` roundtrips |
| **Operational Excellence** | Module structure, comment-based help, Pester tests, PSScriptAnalyzer enforcement |
| **Performance Efficiency** | Pipeline streaming via `process {}`, `ForEach-Object -Parallel`, splatting over repeated calls |
| **Responsible AI** | Log prompt/response pairs for audit, mask PII in telemetry, enforce content safety checks |
