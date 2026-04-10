---
description: "PowerShell and Pester 5.x coding standards — function design, test templates, assertion reference, coverage configuration, CI/CD commands"
applyTo: "**/*.{ps1,psm1,psd1,Tests.ps1}"
---

# Pester Test Development — Coding Standards

> This file is a deep reference for PowerShell/Pester coding standards. It supplements copilot-instructions.md (which is auto-injected). Read this file when generating or reviewing Pester tests.

## Project Structure

```
project/
├── src/                          # PowerShell source code (.ps1, .psm1)
│   ├── Get-PolicyCompliance.ps1
│   ├── Set-NsgDiagnostics.ps1
│   └── Invoke-PolicyRemediation.ps1
├── tests/                        # Pester test files (.Tests.ps1)
│   ├── Get-PolicyCompliance.Tests.ps1
│   ├── Set-NsgDiagnostics.Tests.ps1
│   ├── Invoke-PolicyRemediation.Tests.ps1
│   └── TestHelpers/
│       └── PolicyTestData.ps1    # Reusable test data factory functions
├── .github/                      # Copilot agentic OS (agents, instructions, prompts, skills)
├── config/                       # Configuration reference (agents.json, guardrails.json)
├── reports/                      # Generated test artifacts
│   ├── coverage.xml              # JaCoCo format
│   └── test-results.xml          # NUnit format
└── PesterConfiguration.ps1       # Shared Pester config (optional)
```

## PowerShell Coding Standards

### Function Design
```powershell
function Get-PolicyCompliance {
    [CmdletBinding()]
    [OutputType([PSCustomObject])]
    param(
        [Parameter(Mandatory, ValueFromPipeline)]
        [ValidateNotNullOrEmpty()]
        [string]$PolicyName,

        [Parameter()]
        [ValidateSet('Management', 'Subscription', 'ResourceGroup')]
        [string]$ScopeLevel = 'Management'
    )

    process {
        try {
            # Implementation
            Write-Verbose "Checking compliance for $PolicyName at $ScopeLevel scope"
            $state = Get-AzPolicyState -PolicyDefinitionName $PolicyName -ErrorAction Stop
            [PSCustomObject]@{
                PolicyName = $PolicyName
                State = $state.ComplianceState
                ResourceId = $state.ResourceId
                Timestamp = Get-Date
            }
        }
        catch {
            Write-Error "Failed to get compliance for $PolicyName: $_"
            throw
        }
    }
}
```

### MUST Rules
- Always use `[CmdletBinding()]` on every function
- Always add `[OutputType()]` attribute
- Always add `[Parameter()]` with Mandatory, ValidateSet, ValidateNotNullOrEmpty
- Use approved verbs only: Get, Set, New, Remove, Invoke, Test, Export, Import
- Use PascalCase for function names, camelCase for local variables
- Handle errors with try/catch and `-ErrorAction Stop` on external calls
- Never use Write-Host for programmatic output — use Write-Output or return values
- Use Write-Verbose for diagnostic output, Write-Debug for detailed tracing
- Add comment-based help: .SYNOPSIS, .DESCRIPTION, .PARAMETER, .EXAMPLE

### File Naming
- Source: `Verb-Noun.ps1` (e.g., `Get-PolicyCompliance.ps1`)
- Test: `Verb-Noun.Tests.ps1` (e.g., `Get-PolicyCompliance.Tests.ps1`)
- Module: `ModuleName.psm1` with `ModuleName.psd1` manifest
- Test helpers: `tests/TestHelpers/DataFactory.ps1`

## Pester 5.x Test Standards

### Test File Template
```powershell
#Requires -Modules Pester

BeforeAll {
    . $PSScriptRoot/../src/Get-PolicyCompliance.ps1
}

Describe 'Get-PolicyCompliance' -Tag 'Unit' {
    BeforeAll {
        Mock Connect-AzAccount { }
        Mock Get-AzContext { @{ Subscription = @{ Id = '00000000-0000-0000-0000-000000000000' } } }
    }

    Context 'When policy is compliant' {
        BeforeAll {
            Mock Get-AzPolicyState { [PSCustomObject]@{ ComplianceState = 'Compliant' } }
        }

        It 'Returns compliant status' {
            $result = Get-PolicyCompliance -PolicyName 'test-policy'
            $result.State | Should -Be 'Compliant'
        }

        It 'Calls Get-AzPolicyState exactly once' {
            Should -Invoke Get-AzPolicyState -Times 1 -Exactly
        }
    }

    Context 'When PolicyName is missing' {
        It 'Throws parameter error' {
            { Get-PolicyCompliance } | Should -Throw '*PolicyName*'
        }
    }

    Context 'When Azure call fails' {
        BeforeAll {
            Mock Get-AzPolicyState { throw 'Service unavailable' }
        }

        It 'Propagates the error' {
            { Get-PolicyCompliance -PolicyName 'test' } | Should -Throw '*Service unavailable*'
        }
    }
}
```

### Assertion Reference
| Assertion | Use When |
|-----------|----------|
| `Should -Be` | Exact equality (case-insensitive strings) |
| `Should -BeExactly` | Case-sensitive string comparison |
| `Should -BeLike` | Wildcard pattern matching |
| `Should -Match` | Regex matching |
| `Should -BeOfType` | Type validation |
| `Should -HaveCount` | Collection size |
| `Should -Contain` | Collection membership |
| `Should -Exist` | File/path existence |
| `Should -Throw` | Error validation (use with error message pattern) |
| `Should -BeTrue` / `Should -BeFalse` | Boolean checks |
| `Should -BeNullOrEmpty` | Null/empty checks |
| `Should -Not -BeNullOrEmpty` | Non-null checks |
| `Should -Invoke` | Mock verification (-Times, -Exactly, -ParameterFilter) |

### Mock Scope Rules
- **Describe-level BeforeAll**: Shared across all contexts (authentication mocks)
- **Context-level BeforeAll**: Scenario-specific mocks (compliant vs non-compliant)
- **It-level**: One-time override (rare, use for edge cases only)

### Coverage Configuration
```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Run.Exit = $true
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

### Coverage Thresholds
| Metric | Minimum | Warning | Target |
|--------|---------|---------|--------|
| Line coverage | 85% | 88% | ≥90% |
| Branch coverage | 70% | 75% | ≥80% |
| Function coverage | 95% | 98% | 100% |

## Error Handling in Tests

### Testing Error Paths
```powershell
Context 'Error handling' {
    It 'Throws when service is unavailable' {
        Mock Get-AzPolicyState { throw 'Connection refused' }
        { Get-PolicyCompliance -PolicyName 'test' } | Should -Throw '*Connection refused*'
    }

    It 'Returns empty when no resources match' {
        Mock Get-AzPolicyState { $null }
        $result = Get-PolicyCompliance -PolicyName 'test'
        $result | Should -BeNullOrEmpty
    }
}
```

## Dependencies
- PowerShell 7.2+ (or Windows PowerShell 5.1)
- Pester 5.5+ (`Install-Module Pester -Force`)
- Az PowerShell module (for Azure scenarios): `Install-Module Az -Force`
- PSScriptAnalyzer (optional, for linting): `Install-Module PSScriptAnalyzer -Force`

## Quick Reference Commands
```powershell
# Run all tests with coverage
Invoke-Pester -Path ./tests -CodeCoverage ./src -Output Detailed

# Run only unit tests
Invoke-Pester -Path ./tests -Tag 'Unit' -Output Detailed

# Run specific test file
Invoke-Pester -Path ./tests/Get-PolicyCompliance.Tests.ps1 -Output Detailed

# Lint source code
Invoke-ScriptAnalyzer -Path ./src -Recurse -ReportSummary
```

## CRITICAL: Should -Invoke Scope Pitfall

`Should -Invoke` defaults to `It` scope and CANNOT see function calls made in `BeforeAll`. This is the #1 cause of "Expected 1 call but got 0" failures.

```powershell
# ❌ WRONG — reports 0 invocations (default scope = It)
Context 'When resource exists' {
    BeforeAll { $result = Get-ServerHealth -ServerName 'srv01' }
    It 'Calls Test-Connection' {
        Should -Invoke Test-Connection -Times 1 -Exactly  # FAILS: 0 calls
    }
}

# ✅ CORRECT — -Scope Context sees BeforeAll calls
Context 'When resource exists' {
    BeforeAll { $result = Get-ServerHealth -ServerName 'srv01' }
    It 'Calls Test-Connection' {
        Should -Invoke Test-Connection -Times 1 -Exactly -Scope Context  # PASSES
    }
}
```

**Rule:** ALWAYS add `-Scope Context` to `Should -Invoke` when the function under test is called in `BeforeAll`.

## CRITICAL: Scripts With Top-Level Code — Use AST Extraction

Scripts with inline `Write-Host`, `Read-Host`, or `exit` at the top level CANNOT be dot-sourced — they execute on import and crash the test runner.

```powershell
# ❌ WRONG — top-level code executes on import
BeforeAll { . $PSScriptRoot/../src/LegacyScript.ps1 }  # Runs Write-Host, Read-Host, exit

# ✅ CORRECT — AST extraction loads ONLY function definitions
BeforeAll {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        "$PSScriptRoot/../src/LegacyScript.ps1", [ref]$null, [ref]$null)
    $functions = $ast.FindAll({
        $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)
    foreach ($fn in $functions) { Invoke-Expression $fn.Extent.Text }
}
```

**Rule:** If a source file has ANY top-level code (not inside a function), use AST extraction instead of dot-sourcing.
