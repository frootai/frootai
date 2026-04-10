---
name: generate-tests
description: "Generate Pester 5.x test suites for PowerShell modules — AST analysis, mock generation, coverage targeting, builder-reviewer-tuner chain. Use when: writing tests, creating tests, test generation, Pester tests, unit tests, integration tests, add test coverage, mock dependencies."
---

# Generate Pester 5.x Tests

## When to Use
- User asks to generate, write, or create tests for PowerShell code
- User asks to add test coverage to existing modules or scripts
- User mentions Pester, mocking, code coverage, or unit/integration testing
- User says "test this function", "add tests", "write tests for X"

## Prerequisites
- PowerShell 7+ or Windows PowerShell 5.1+
- Pester 5.5.0+ installed: `Install-Module Pester -MinimumVersion 5.5.0 -Force`
- Source code in `./src/` (or specify path)
- Tests output to `./tests/` (parallel directory structure)

## Phase 1: Discovery — Scan the Codebase

Use AST to find all functions, their parameters, dependencies, and complexity:

```powershell
# Discover all PowerShell source files
$sourceFiles = Get-ChildItem -Path ./src -Include '*.ps1','*.psm1' -Recurse

foreach ($file in $sourceFiles) {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName, [ref]$null, [ref]$null
    )

    # Find all function definitions
    $functions = $ast.FindAll({
        $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)

    # Find all command calls (dependencies to mock)
    $commands = $ast.FindAll({
        $args[0] -is [System.Management.Automation.Language.CommandAst]
    }, $true)

    Write-Host "$($file.Name): $($functions.Count) functions, $($commands.Count) commands"
}
```

**Output: Test Creation Report** — file count, function count, testability scores (0-100%), anti-patterns flagged.

## Phase 2: Dependency Mapping — Build Mock Graph

For each function, identify what needs mocking:

| Dependency Type | Detection | Mock Strategy |
|----------------|-----------|---------------|
| Az.* cmdlets | `Get-Az*`, `New-Az*`, `Set-Az*` | `Mock Get-AzResource { [PSCustomObject]@{...} }` |
| File I/O | `Get-Content`, `Set-Content`, `Test-Path` | Use `TestDrive:` PSDrive |
| Registry | `Get-ItemProperty`, `Set-ItemProperty` | Use `TestRegistry:` PSDrive |
| REST APIs | `Invoke-RestMethod`, `Invoke-WebRequest` | Mock with JSON response objects |
| Active Directory | `Get-ADUser`, `Get-ADGroup` | Mock with PSCustomObject hashtables |
| SQL | `Invoke-Sqlcmd`, `Invoke-DbaQuery` | Mock with DataTable objects |
| .NET types | `[System.IO.File]`, `[HttpClient]` | Create thin wrapper function → mock wrapper |
| Authentication | `Connect-AzAccount`, `Get-AzContext` | Always mock — prevent real API calls |

**Output: Dependency & Requirement Mapping Report** — per-function parameters, return types, mock graph.

## Phase 3: Test Points — Identify What to Test

For each function, define the test matrix:

| Test Category | What to Test | Example It Block |
|--------------|-------------|-----------------|
| Happy path | Normal input → expected output | `It 'Returns compliant status' { ... Should -Be 'Compliant' }` |
| Error path | Invalid input → throws | `It 'Throws on null input' { { Fn $null } \| Should -Throw }` |
| Edge cases | Empty array, $null, boundary | `It 'Handles empty collection' { Fn @() \| Should -BeNullOrEmpty }` |
| Parameter validation | Mandatory, ValidateSet | `It 'Rejects invalid scope' { { Fn -Scope 'Bad' } \| Should -Throw }` |
| Mock verification | Dependencies called correctly | `It 'Calls API once' { Should -Invoke Get-AzResource -Times 1 -Exactly }` |
| Pipeline | ValueFromPipeline input | `It 'Accepts pipeline' { 'input' \| Fn \| Should -Not -BeNullOrEmpty }` |

**Output: Test Points Identification Report** — per-function test matrix with categories.

## Phase 4: Test Generation — Write the Tests

Generate Pester 5.x test files following this exact structure:

```powershell
#Requires -Modules Pester

BeforeAll {
    . $PSScriptRoot/../src/Get-PolicyCompliance.ps1
}

Describe 'Get-PolicyCompliance' -Tag 'Unit' {
    BeforeAll {
        # Always mock authentication
        Mock Connect-AzAccount { }
        Mock Get-AzContext {
            @{ Subscription = @{ Id = '00000000-0000-0000-0000-000000000000' } }
        }
    }

    Context 'When policy is compliant' {
        BeforeAll {
            Mock Get-AzPolicyState {
                [PSCustomObject]@{ ComplianceState = 'Compliant' }
            }
        }

        It 'Returns compliant status' {
            $result = Get-PolicyCompliance -PolicyName 'test-policy'
            $result.State | Should -Be 'Compliant'
        }

        It 'Calls Get-AzPolicyState exactly once' {
            Should -Invoke Get-AzPolicyState -Times 1 -Exactly
        }
    }

    Context 'Parameter validation' {
        It 'Throws when PolicyName is missing' {
            { Get-PolicyCompliance } | Should -Throw '*PolicyName*'
        }
    }
}
```

### Non-Negotiable Rules
- `BeforeAll` for dot-sourcing (never script-scope)
- `Should -BeTrue` not `Should -Be $true`
- `Should -BeNullOrEmpty` not `Should -Be $null`
- `Should -Invoke` not `Assert-MockCalled` (deprecated)
- `-Tag 'Unit'` or `-Tag 'Integration'` on every Describe
- `-TestCases` or `-ForEach` for data-driven (no copy-paste It blocks)
- One test file per source file: `Get-Policy.ps1` → `Get-Policy.Tests.ps1`

## Phase 5: Run and Validate

```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Run.PassThru = $true
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.CodeCoverage.OutputFormat = 'JaCoCo'
$config.CodeCoverage.OutputPath = './reports/coverage.xml'
$config.CodeCoverage.CoveragePercentTarget = 90
$config.TestResult.Enabled = $true
$config.TestResult.OutputFormat = 'NUnitXml'
$config.TestResult.OutputPath = './reports/test-results.xml'
$config.Output.Verbosity = 'Detailed'
$result = Invoke-Pester -Configuration $config
```

**Output: Code Coverage Report** — line/branch/function % vs targets, uncovered lines.

## Phase 6: Fix Gaps (if coverage < 90%)

If tests fail or coverage is below target:
1. Analyze `$result.CodeCoverage.CommandsMissed` — which lines uncovered
2. If uncovered line is in `if/else` → add Context with Mock that triggers the branch
3. If uncovered line is in `catch` → add It with Mock that throws
4. If uncovered line is in `switch` → add `-TestCases` for each case value
5. Invoke tuner subagent for complex gap analysis

**Output: Final Validation Report** — test count, pass rate, coverage achieved, recommendations.

## Context Management (Critical for Large Codebases)
- More than 3 source files → process ONE module at a time via subagents
- Each subagent gets a fresh context window (prevents crashes)
- Summarize results between modules to preserve context budget
- Chain: builder (generate) → reviewer (validate) → tuner (fix gaps)

## Non-Negotiable Rules (From Production Testing)

1. **-Scope Context on ALL Should -Invoke**: When the function under test is called in `BeforeAll`, `Should -Invoke` defaults to `It` scope and reports 0 calls. Always add `-Scope Context`.

2. **AST extraction for scripts with top-level code**: If a .ps1 file has ANY code outside of functions (Write-Host, Read-Host, exit, variable assignments), do NOT dot-source it. Use AST `ParseFile` to extract only function definitions, then `Invoke-Expression` each one.

3. **Replace exit with throw**: `exit` is a PowerShell keyword that cannot be mocked. When extracting functions that contain `exit N`, replace with `throw "Exit code: N"` or `return $N`.

4. **Wrap Group-Object in @()**: `($data | Group-Object X).Count` returns item count when there's a single group. Always use `@($data | Group-Object X).Count` to get group count.
