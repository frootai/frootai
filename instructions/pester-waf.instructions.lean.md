---
description: "Pester 5 testing standards — Describe/It blocks, TestDrive, and PowerShell module testing patterns."
applyTo: "**/*.Tests.ps1"
waf:
  - "reliability"
  - "operational-excellence"
---

# Pester — FAI Standards

## Pester 5.x Block Structure

Use `Describe` for the unit under test, `Context` for scenarios, `It` for individual assertions. Never nest `Describe` inside `Describe` — use `Context` for sub-grouping.

```powershell
Describe 'Get-UserReport' {
    BeforeAll {
        . $PSScriptRoot/../src/Get-UserReport.ps1
    }

    Context 'When user exists' {
        BeforeEach {
            Mock Get-ADUser { [PSCustomObject]@{ Name = 'Alice'; Enabled = $true } }
        }

        It 'Returns the user object' {
            $result = Get-UserReport -UserName 'Alice'
            $result.Name | Should -Be 'Alice'
        }

        It 'Calls Get-ADUser exactly once' {
            Get-UserReport -UserName 'Alice'
            Should -Invoke Get-ADUser -Times 1 -Exactly
        }
    }

    Context 'When user does not exist' {
        BeforeEach {
            Mock Get-ADUser { throw [Microsoft.ActiveDirectory.Management.ADIdentityNotFoundException]::new() }
        }

        It 'Throws a descriptive error' {
            { Get-UserReport -UserName 'Ghost' } | Should -Throw '*not found*'
        }
    }
}
```

## Setup and Teardown

- `BeforeAll` / `AfterAll` — run once per `Describe` or `Context` block. Use for expensive setup (module import, DB seed).
- `BeforeEach` / `AfterEach` — run before/after every `It`. Use for per-test isolation (mocks, state reset).
- Variables set in `BeforeAll` are visible in `It` blocks via `$script:` or block-scoped assignment.

## Should Assertions

| Assertion | Use When |
| --- | --- |
| `Should -Be $expected` | Case-insensitive string/value equality |
| `Should -BeExactly $expected` | Case-sensitive string comparison |
| `Should -BeNullOrEmpty` | Null/empty check |
| `Should -HaveCount 3` | Collection length |
| `Should -Contain 'item'` | Collection membership |
| `Should -BeOfType [hashtable]` | Type validation |
| `Should -Throw '*message*'` | Exception with wildcard match |
| `Should -Not -Exist` | File/path does not exist (TestDrive) |
| `Should -BeGreaterThan 0` | Numeric comparison |
| `Should -Match '^\d{4}-\d{2}'` | Regex match |

## Mocking

Mock within the scope where the function under test calls the dependency. Use `-ParameterFilter` to differentiate mock behavior per input.

```powershell
Context 'Selective mocking' {
    BeforeAll {
        Mock Invoke-RestMethod { @{ status = 'healthy' } } -ParameterFilter { $Uri -like '*/health' }
        Mock Invoke-RestMethod { @{ data = @(1,2,3) } }  -ParameterFilter { $Uri -like '*/api/*' }
    }

    It 'Routes to the correct mock' {
        (Invoke-RestMethod -Uri 'https://svc/health').status | Should -Be 'healthy'
        (Invoke-RestMethod -Uri 'https://svc/api/items').data | Should -HaveCount 3
    }
}
```

### Assert-MockCalled / Should -Invoke

Pester 5 uses `Should -Invoke`. Add `-Scope Context` when the function under test runs in `BeforeAll`.

```powershell
Should -Invoke Send-MailMessage -Times 1 -Exactly -Scope Context
Should -Invoke Write-Warning -Times 0
```

## TestDrive for File Operations

`TestDrive:` is an auto-cleaned temporary directory per `Describe`. Use it instead of writing to real paths.

```powershell
Describe 'Export-Report' {
    It 'Creates a CSV in the output folder' {
        Export-Report -Path 'TestDrive:/reports'
        'TestDrive:/reports/summary.csv' | Should -Exist
        $csv = Import-Csv 'TestDrive:/reports/summary.csv'
        $csv | Should -HaveCount 5
    }
}
```

## Parameterized Tests with -TestCases / -ForEach

```powershell
Describe 'ConvertTo-Celsius' {
    It 'Converts <Fahrenheit>°F to <Expected>°C' -ForEach @(
        @{ Fahrenheit = 32;  Expected = 0 }
        @{ Fahrenheit = 212; Expected = 100 }
        @{ Fahrenheit = -40; Expected = -40 }
    ) {
        ConvertTo-Celsius -Fahrenheit $Fahrenheit | Should -Be $Expected
    }
}
```

## Tagging and Selective Execution

Tag tests for filtering in CI. Avoid running slow integration tests on every commit.

```powershell
Describe 'Database integration' -Tag 'Integration', 'Slow' {
    It 'Inserts a record' -Tag 'Write' { <# ... #> }
}
```

```powershell
# Run only unit tests
Invoke-Pester -Path ./tests -Tag 'Unit' -ExcludeTag 'Slow'
```

## InModuleScope for Private Functions

Test non-exported functions without exposing them publicly.

```powershell
Describe 'Private helper' {
    It 'Formats the internal key' {
        InModuleScope 'MyModule' {
            Format-InternalKey -Raw 'abc-123' | Should -Be 'ABC_123'
        }
    }
}
```

## Code Coverage

```powershell
$config = New-PesterConfiguration
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = @('./src/*.ps1')
$config.CodeCoverage.CoveragePercentTarget = 80
Invoke-Pester -Configuration $config
```

## CI Integration

```powershell
# GitHub Actions / Azure DevOps — single line
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Run.Exit = $true                          # Non-zero exit on failure
$config.TestResult.Enabled = $true
$config.TestResult.OutputFormat = 'NUnitXml'       # Or 'JUnitXml'
$config.TestResult.OutputPath = './results/tests.xml'
$config.Output.Verbosity = 'Detailed'
Invoke-Pester -Configuration $config
```

The `-CI` switch is shorthand: enables exit-on-failure + NUnit output + Detailed verbosity.

## Anti-Patterns

- ❌ Nesting `Describe` inside `Describe` — use `Context` for sub-groups
- ❌ Dot-sourcing scripts with top-level `exit`/`Write-Host` without AST extraction
- ❌ Omitting `-Scope Context` on `Should -Invoke` when setup runs in `BeforeAll`
- ❌ Using `Assert-MockCalled` (Pester 4 legacy) — use `Should -Invoke` in Pester 5
- ❌ Writing to real filesystem paths instead of `TestDrive:`
- ❌ Single `It` block with dozens of assertions — split into focused test cases
- ❌ Not using `-Exactly` on `Should -Invoke` — default allows "at least N" which hides bugs
- ❌ Wrapping `@()` around `Group-Object` result when checking `.Count` of a single group vs group count
- ❌ Mocking `exit` directly — it's a keyword, not a command; use AST rewrite

## WAF Alignment

| Pillar | Pester Practice |
|--------|----------------|
| **Reliability** | `Should -Throw` for error-path coverage; `-ForEach` for boundary/edge cases; `TestDrive:` for safe file I/O isolation |
| **Operational Excellence** | `Invoke-Pester -CI` in pipelines; NUnit/JUnit XML for test dashboards; `-Tag` for fast vs full suites |
| **Security** | Never embed real secrets in test data; mock `Invoke-RestMethod` instead of calling live APIs; `InModuleScope` to verify private validation logic |
| **Cost Optimization** | `-ExcludeTag 'Slow'` on PR builds; run integration tests only on main; code coverage to find dead code |
| **Performance Efficiency** | `BeforeAll` for expensive one-time setup; `BeforeEach` only for cheap per-test reset; parallel discovery via `Invoke-Pester -Path ./tests` |
