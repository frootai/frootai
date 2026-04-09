# Play 101: Pester Test Development

> **FrootAI Solution Play** — Production-grade Pester Test Development on Azure with FAI Protocol integration

[![WAF Aligned](https://img.shields.io/badge/WAF-6%2F6%20Pillars-green)](#waf-alignment)
[![Azure](https://img.shields.io/badge/Azure-AI%20Services-blue)](#azure-services)
[![FAI Protocol](https://img.shields.io/badge/FAI-Protocol%20v1-purple)](#fai-protocol)

## Overview

This play provides an end-to-end AI pipeline for PowerShell Pester test modernization:
- **Discovery**: AST-based codebase scanning for functions, modules, dependencies
- **Assessment**: Testability scoring (0-100%) per file, flagging Write-Host and untestable patterns
- **Dependency Mapping**: Mock graph generation for Az.*, AD, SQL, file I/O, REST APIs
- **Legacy Refactoring**: Extract functions from monolithic scripts, parameterize hardcoded values
- **Test Generation**: Pester 5.x tests with Describe/Context/It, Mocks, TestCases, coverage
- **Validation**: >90% code coverage with JaCoCo, CI/CD integration (Azure DevOps + GitHub Actions)

### Use Cases
- New module development with TDD (test-first approach)
- Adding tests to legacy PowerShell scripts and modules
- Azure Policy testing: PolicyDefinition, PolicySetDefinition, PolicyAssignment, Remediation
- Migrating from Pester 4.x to Pester 5.x syntax

This solution play implements a production-ready Pester Test Development system using Azure AI Services, following the FrootAI FAI Protocol for AI primitive unification and the Azure Well-Architected Framework (WAF) across all six pillars.

## Architecture

```mermaid
graph TB
    Client[Client Application] --> API[API Gateway / APIM]
    API --> App[Application Service]
    App --> OpenAI[Azure OpenAI<br/>GPT-4o]
    App --> Search[Data Store<br/>AI Search / Cosmos DB]
    App --> KV[Azure Key Vault]
    App --> AI[Application Insights]
    
    subgraph Monitoring
        AI --> LA[Log Analytics]
        LA --> Alerts[Alert Rules]
    end
    
    subgraph Security
        KV --> MI[Managed Identity]
        MI --> RBAC[RBAC Roles]
    end
```

## Azure Services
| Service | Purpose | SKU (Prod) |
|---------|---------|------------|
| Azure OpenAI | Model inference (GPT-4o, embeddings) | S0 + GlobalStandard |
| Azure Key Vault | Secret management | Standard |
| Application Insights | Monitoring, tracing | Pay-as-you-go |
| Log Analytics | Log aggregation, KQL queries | PerGB2018 |
| Azure Storage | Data persistence | Standard_GRS |

## Prerequisites
- Azure subscription with Contributor access
- Azure CLI v2.60+ (`az --version`)
- Azure Developer CLI v1.9+ (`azd version`)
- Python 3.10+ (for evaluation pipeline)
- Node.js 20+ (for MCP integration)

## Quickstart

### 1. Clone and Navigate
```bash
git clone https://github.com/frootai/frootai.git
cd solution-plays/101-pester-test-development
```

### 2. Deploy Infrastructure
```bash
az login
azd init
azd up --environment dev
```

### 3. Verify Deployment
```bash
curl -s https://${APP_URL}/health | jq .
```

### 4. Run Evaluation
```bash
pip install -r evaluation/requirements.txt
python evaluation/eval.py --ci-gate
```

### 5. Use with Copilot
Open this folder in VS Code with GitHub Copilot. The agent chain (builder → reviewer → tuner) activates automatically.

## Configuration
All settings are in the `config/` directory:

| File | Description |
|------|-------------|
| `openai.json` | Model parameters (temperature, max_tokens, model) |
| `agents.json` | Agent behavior and handoff rules |
| `guardrails.json` | Content safety thresholds and evaluation gates |
| `model-comparison.json` | Model cost/quality comparison matrix |
| `chunking.json` | Data processing configuration |
| `search.json` | Search/retrieval settings |

## Agent Chain (DevKit)
This play includes three specialized agents:

| Agent | File | Role |
|-------|------|------|
| **Builder** | `.github/agents/builder.agent.md` | Implements features, writes code |
| **Reviewer** | `.github/agents/reviewer.agent.md` | Reviews security, quality, WAF compliance |
| **Tuner** | `.github/agents/tuner.agent.md` | Optimizes config for production |

Workflow: `@builder` → `@reviewer` → `@tuner` → Production Ready

## Evaluation Pipeline
The evaluation pipeline (`evaluation/eval.py`) measures:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| Relevance | ≥ 0.80 | Response addresses the query |
| Groundedness | ≥ 0.85 | Grounded in provided context |
| Coherence | ≥ 0.80 | Logically consistent |
| Fluency | ≥ 0.85 | Grammatically correct |
| Safety | ≥ 0.95 | No harmful content |
| Latency p95 | ≤ 3s | Response time |

```bash
python evaluation/eval.py --report html --output evaluation/report.html
```

## WAF Alignment
| Pillar | Implementation |
|--------|---------------|
| **Reliability** | Retry policies, health checks, circuit breaker, graceful degradation |
| **Security** | Managed Identity, Key Vault, Content Safety, RBAC, encryption |
| **Cost Optimization** | Model routing, caching, right-sized SKUs, token budgets |
| **Operational Excellence** | Bicep IaC, CI/CD, observability, incident runbooks |
| **Performance** | Async patterns, connection pooling, CDN, streaming |
| **Responsible AI** | Content safety, groundedness, fairness, transparency |

## Cost Estimate
| Resource | Dev (monthly) | Prod (monthly) |
|----------|:------------:|:-------------:|
| Azure OpenAI (GPT-4o) | ~$50 | ~$500 |
| Azure OpenAI (Embeddings) | ~$10 | ~$100 |
| Key Vault | ~$1 | ~$5 |
| Application Insights | ~$5 | ~$50 |
| Storage | ~$2 | ~$20 |
| **Total** | **~$68** | **~$675** |

## Troubleshooting

### Common Issues
| Issue | Solution |
|-------|---------|
| `DefaultAzureCredential` fails | Run `az login`, check RBAC assignments |
| Model deployment not found | Verify deployment name in openai.json matches Azure portal |
| Rate limit (429) | Check PTU capacity, implement retry with backoff |
| Content blocked | Review Content Safety thresholds in guardrails.json |
| High latency | Enable caching, reduce max_tokens, check network path |

## FAI Protocol
This play is wired through `fai-manifest.json`:
- **Context:** Knowledge modules define what the play knows
- **Primitives:** Agents, instructions, skills, hooks wired together
- **Infrastructure:** Azure resource requirements defined in Bicep
- **Guardrails:** Quality gates and safety rules enforced at runtime

## Contributing
See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines. Use the agent chain:
1. `@builder` to implement changes
2. `@reviewer` to validate quality
3. `@tuner` to optimize for production

## License
MIT — see [LICENSE](../../LICENSE)


## Quick Start

### Prerequisites
- PowerShell 7.2+ (or Windows PowerShell 5.1)
- Pester 5.5+ (`Install-Module Pester -Force`)
- Az PowerShell module (for Azure Policy scenarios)

### Run Tests with Coverage
```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.CodeCoverage.OutputFormat = 'JaCoCo'
$config.CodeCoverage.OutputPath = './reports/coverage.xml'
$config.CodeCoverage.CoveragePercentTarget = 90
$config.TestResult.Enabled = $true
$config.TestResult.OutputFormat = 'NUnitXml'
$config.TestResult.OutputPath = './reports/test-results.xml'
$config.Output.Verbosity = 'Detailed'
Invoke-Pester -Configuration $config
```

### .NET / Add-Type Thin Wrapper Pattern
```powershell
# Create a thin PowerShell wrapper around .NET class for testability
Add-Type -TypeDefinition @"
public class PolicyValidator {
    public static bool ValidateJson(string json) {
        try { System.Text.Json.JsonDocument.Parse(json); return true; }
        catch { return false; }
    }
}
"@

function Test-PolicyJson {
    [CmdletBinding()]
    [OutputType([bool])]
    param([Parameter(Mandatory)][string]$JsonContent)
    return [PolicyValidator]::ValidateJson($JsonContent)
}

# Now testable with Pester:
# Mock calls to Test-PolicyJson or test the wrapper directly
```

### Azure DevOps Pipeline
```yaml
- task: PowerShell@2
  displayName: 'Pester Tests + Coverage'
  inputs:
    targetType: 'inline'
    pwsh: true
    script: |
      $config = New-PesterConfiguration
      $config.Run.Path = '$(Build.SourcesDirectory)/tests'
      $config.CodeCoverage.Enabled = $true
      $config.CodeCoverage.Path = '$(Build.SourcesDirectory)/src'
      $config.CodeCoverage.OutputFormat = 'JaCoCo'
      $config.CodeCoverage.OutputPath = '$(Build.SourcesDirectory)/coverage.xml'
      $config.CodeCoverage.CoveragePercentTarget = 90
      $config.TestResult.Enabled = $true
      $config.TestResult.OutputPath = '$(Build.SourcesDirectory)/test-results.xml'
      $config.Run.Exit = $true
      Invoke-Pester -Configuration $config

- task: PublishTestResults@2
  inputs: { testResultsFormat: 'NUnit', testResultsFiles: 'test-results.xml' }

- task: PublishCodeCoverageResults@2
  inputs: { codeCoverageTool: 'JaCoCo', summaryFileLocation: 'coverage.xml' }
```

### GitHub Actions
```yaml
- name: Pester Tests
  shell: pwsh
  run: |
    Install-Module Pester -Force -Scope CurrentUser
    $config = New-PesterConfiguration
    $config.Run.Path = './tests'
    $config.CodeCoverage.Enabled = $true
    $config.CodeCoverage.Path = './src'
    $config.CodeCoverage.OutputFormat = 'JaCoCo'
    $config.CodeCoverage.CoveragePercentTarget = 90
    $config.Run.Exit = $true
    Invoke-Pester -Configuration $config
```

## Advanced Pester Patterns

### InModuleScope — Testing Private Functions
```powershell
InModuleScope 'AzPolicyAutomation' {
    Describe 'Internal Helper: Resolve-PolicyScope' {
        It 'Resolves management group scope correctly' {
            $result = Resolve-PolicyScope -ScopeName 'mg-root'
            $result | Should -Match '/providers/Microsoft.Management/managementGroups/'
        }
    }
}
```

### BeforeDiscovery — Dynamic Test Case Generation
```powershell
BeforeDiscovery {
    $policyFiles = Get-ChildItem -Path './policies' -Filter '*.json'
    $testCases = $policyFiles | ForEach-Object { @{ Name = $_.BaseName; Path = $_.FullName } }
}

Describe 'Policy JSON Validation' {
    It '<Name> is valid JSON with required properties' -ForEach $testCases {
        $policy = Get-Content $Path -Raw | ConvertFrom-Json
        $policy.properties.policyType | Should -Be 'Custom'
        $policy.properties.displayName | Should -Not -BeNullOrEmpty
    }
}
```

### Mock with ParameterFilter — Conditional Behavior
```powershell
Mock Get-AzPolicyState -ParameterFilter { $PolicyDefinitionName -eq 'compliant' } {
    [PSCustomObject]@{ ComplianceState = 'Compliant' }
}
Mock Get-AzPolicyState -ParameterFilter { $PolicyDefinitionName -eq 'noncompliant' } {
    [PSCustomObject]@{ ComplianceState = 'NonCompliant'; ResourceId = '/sub/123/rg/test/nsg/nsg1' }
}
```

## File Structure
```
.
├── .github/                 # DevKit (agents, instructions, prompts, skills, hooks, workflows)
├── .vscode/                 # VS Code settings and MCP config
├── config/                  # All configuration files (JSON)
├── evaluation/              # Quality evaluation pipeline (eval.py, test-set.jsonl)
├── infra/                   # Azure infrastructure (Bicep, ARM, parameters)
├── mcp/                     # MCP server plugin integration
├── plugins/                 # Plugin documentation
├── spec/                    # Architecture specification
├── agent.md                 # Root agent definition
├── CHANGELOG.md             # Version history
├── fai-manifest.json        # FAI Protocol manifest (primitives, context, guardrails)
├── froot.json               # Play metadata
├── instructions.md          # Root coding instructions
├── plugin.json              # Plugin manifest
└── README.md                # This file
```

## Related Resources
- **Solution Plays Catalog:** [frootai.dev/solution-plays](https://frootai.dev/solution-plays)
- **FAI Protocol:** [frootai.dev/fai-protocol](https://frootai.dev/fai-protocol)
- **Primitives Catalog:** [frootai.dev/primitives](https://frootai.dev/primitives)
- **Learning Hub:** [frootai.dev/learning-hub](https://frootai.dev/learning-hub)
- **GitHub:** [github.com/frootai/frootai](https://github.com/frootai/frootai)

## Changelog
See [CHANGELOG.md](CHANGELOG.md) for version history.

## Support
- **Issues:** [github.com/frootai/frootai/issues](https://github.com/frootai/frootai/issues)
- **Discussions:** [github.com/frootai/frootai/discussions](https://github.com/frootai/frootai/discussions)
- **MCP Server:** `npx frootai-mcp@latest` (25 tools for AI architecture)
- **VS Code Extension:** Search "FrootAI" in VS Code Marketplace
