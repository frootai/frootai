---
description: "Pester 5.x test development patterns — function extraction, mock strategies, coverage analysis, CI/CD integration, Azure Policy testing"
applyTo: "**/*.{ps1,psm1,psd1,Tests.ps1}"
waf: ["reliability", "operational-excellence"]
---

# Pester Test Development Patterns

## Pattern 1: Function Extraction from Legacy Scripts

### Problem
Legacy PowerShell scripts with inline code, no functions, no param blocks. Impossible to unit test.

### Solution — AST-Based Analysis
```powershell
# Discover functions in a script using AST
$ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$null, [ref]$null)
$functions = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)
$commands = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.CommandAst] }, $true)
```

### Refactoring Steps
```powershell
# BEFORE — untestable
$vms = Get-AzVM
foreach ($vm in $vms) { Write-Host "Processing $($vm.Name)" }

# AFTER — testable
function Invoke-VMProcessing {
    [CmdletBinding()][OutputType([PSCustomObject[]])]
    param([Parameter(Mandatory)][object[]]$VMs)
    foreach ($vm in $VMs) {
        Write-Verbose "Processing $($vm.Name)"
        [PSCustomObject]@{ Name = $vm.Name; Status = 'Processed' }
    }
}
```

## Pattern 2: Mock Dependency Graph

### Identify Dependencies at the Right Level
```
Level 0: Your function (NEVER mock this)
Level 1: Direct dependencies (MOCK these)
Level 2: Indirect dependencies (don't need mocking — L1 is mocked)
```

### Dependency Types and Mock Strategies
| Dependency | Examples | Mock Strategy |
|-----------|----------|---------------|
| Azure cmdlets | Connect-AzAccount, Get-AzPolicyState | Mock -CommandName with PSCustomObject returns |
| File system | Get-Content, Set-Content, Test-Path | TestDrive (auto-cleaned PSDrive) |
| Registry | Get-ItemProperty, Set-ItemProperty | TestRegistry |
| Network | Invoke-RestMethod, Invoke-WebRequest | Mock with JSON response objects |
| Active Directory | Get-ADUser, Get-ADGroup | Mock with hashtables |
| SQL | Invoke-Sqlcmd, Invoke-DbaQuery | Mock with DataTable objects |
| .NET types | [System.IO.File], HttpClient | Add-Type thin wrapper → mock wrapper |
| Processes | Start-Process, & operator | Mock with exit codes + output |

## Pattern 3: Azure Policy Lifecycle Testing

```powershell
Describe 'Azure Policy Lifecycle' -Tag 'Integration' {
    BeforeAll {
        Mock Connect-AzAccount { }
        Mock Get-AzContext { @{ Subscription = @{ Id = '00000000-0000-0000-0000-000000000000' } } }
    }

    Context 'PolicyDefinition Validation' {
        BeforeDiscovery {
            $policyFiles = Get-ChildItem './policies/definitions' -Filter '*.json' -ErrorAction SilentlyContinue
            $script:testCases = @()
            if ($policyFiles) { $script:testCases = $policyFiles | ForEach-Object { @{ Name = $_.BaseName; Path = $_.FullName } } }
        }

        It '<Name> is valid JSON with required properties' -ForEach $testCases {
            $policy = Get-Content $Path -Raw | ConvertFrom-Json
            $policy.properties.policyType | Should -Be 'Custom'
            $policy.properties.displayName | Should -Not -BeNullOrEmpty
        }
    }

    Context 'PolicyAssignment Scope' {
        It 'Assigns at management group scope' {
            Mock New-AzPolicyAssignment { @{ PolicyAssignmentId = '/assignments/test' } }
            $result = Deploy-PolicyAssignment -Name 'test' -Scope '/providers/Microsoft.Management/managementGroups/mg1'
            $result | Should -Not -BeNullOrEmpty
            Should -Invoke New-AzPolicyAssignment -Times 1 -Exactly
        }
    }

    Context 'Remediation' {
        It 'Triggers remediation and waits for completion' {
            Mock Start-AzPolicyRemediation { @{ ProvisioningState = 'Accepted' } }
            Mock Get-AzPolicyRemediation { @{ ProvisioningState = 'Succeeded' } }
            $result = Invoke-PolicyRemediation -PolicyName 'nsg-diagnostics'
            Should -Invoke Start-AzPolicyRemediation -Times 1
        }
    }
}
```

## Pattern 4: Test Data Factories

### Problem
Copy-pasting test data across test files = maintenance burden.

### Solution — Reusable Factory Functions
```powershell
# TestHelpers/PolicyTestData.ps1
function New-TestPolicyDefinition {
    param(
        [string]$Name = 'test-policy',
        [string]$Mode = 'All',
        [string]$Effect = 'DeployIfNotExists'
    )
    [PSCustomObject]@{
        Name = $Name
        Properties = [PSCustomObject]@{
            PolicyType = 'Custom'; Mode = $Mode; DisplayName = "Test: $Name"
            PolicyRule = @{
                if = @{ field = 'type'; equals = 'Microsoft.Network/networkSecurityGroups' }
                then = @{ effect = $Effect }
            }
        }
    }
}
```

## Pattern 5: Coverage Gap Analysis

```powershell
$config = New-PesterConfiguration
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.Run.Path = './tests'
$config.Run.PassThru = $true
$result = Invoke-Pester -Configuration $config

# Analyze missed lines
$missed = $result.CodeCoverage.CommandsMissed
$grouped = $missed | Group-Object File | Sort-Object Count -Descending
foreach ($file in $grouped) {
    Write-Host "UNCOVERED: $($file.Name) — $($file.Count) lines"
    $file.Group | ForEach-Object { Write-Host "  Line $($_.Line): $($_.Command)" }
}
```

### Closing Gaps
- Uncovered if/else → add Context with specific Mock setup
- Uncovered catch → add It with Mock that throws
- Uncovered switch case → add -TestCases for each value
- Uncovered helper → add separate Describe block

## Pattern 6: CI/CD Pipeline Integration

### Azure DevOps YAML
```yaml
- task: PowerShell@2
  displayName: 'Pester Tests + Coverage'
  inputs:
    targetType: inline
    pwsh: true
    script: |
      $config = New-PesterConfiguration
      $config.Run.Path = './tests'
      $config.Run.Exit = $true
      $config.CodeCoverage.Enabled = $true
      $config.CodeCoverage.Path = './src'
      $config.CodeCoverage.OutputFormat = 'JaCoCo'
      $config.CodeCoverage.OutputPath = './coverage.xml'
      $config.CodeCoverage.CoveragePercentTarget = 90
      $config.TestResult.Enabled = $true
      $config.TestResult.OutputPath = './test-results.xml'
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
    $config.Run.Exit = $true
    $config.CodeCoverage.Enabled = $true
    $config.CodeCoverage.CoveragePercentTarget = 90
    Invoke-Pester -Configuration $config
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct |
|-------------|---------|---------|
| Mock the function under test | Tests nothing | Only mock dependencies |
| Should -Be $true | Pester 5.x syntax issue | Should -BeTrue |
| No BeforeAll for import | Discovery phase fails | BeforeAll { . $PSScriptRoot/... } |
| Hardcoded paths | Tests fail on other machines | $PSScriptRoot, TestDrive |
| No mock verification | Can't confirm code paths | Should -Invoke -Times -Exactly |
| Monolithic test files | Hard to maintain | One .Tests.ps1 per source file |
| No -Tag on Describe | Can't run selective tests | -Tag 'Unit', 'Integration' |
| Test implementation details | Brittle, breaks on refactor | Test behavior, not internals |
| Copy-paste test data | Maintenance burden | Test data factory functions |
| No error path testing | Miss exception bugs | Test -ErrorAction Stop scenarios |
| `Should -Invoke` without `-Scope Context` | Reports 0 calls for BeforeAll invocations | Add `-Scope Context` to all `Should -Invoke` |
| `exit` in source code | Crashes Pester test runner (keyword, not command) | Replace with `throw` or `return` in extracted code |
| Dot-sourcing scripts with top-level code | Write-Host/Read-Host/exit execute on import | Use AST extraction to load only functions |
| `$grouped.Count` after `Group-Object` | Single group returns item count, not 1 | Wrap in `@()`: `@($x \| Group-Object Y).Count` |
