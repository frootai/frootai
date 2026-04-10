---
name: tune-pester-test-development
description: "Tune, fix, optimize Pester tests — improve code coverage to 90%+, eliminate flaky tests, fix failing tests, optimize mock setup, configure parallel execution, reduce test duration, set up coverage trending. Use when: fix tests, improve coverage, tests failing, flaky, slow tests, optimize, tune, coverage gap."
---

# Tune & Optimize Pester Test Suite

## When to Use
- User asks to fix failing tests
- User asks to improve code coverage (below 90%)
- User reports flaky or intermittent test failures
- User asks to optimize slow tests
- User mentions "tune", "fix", "optimize", "coverage gap", "failing"

## Tuning Targets

| Metric | Minimum | Warning | Target | Action if Below |
|--------|---------|---------|--------|-----------------|
| Line coverage | 85% | 88% | ≥90% | Generate targeted tests for missed lines |
| Branch coverage | 70% | 75% | ≥80% | Add Context blocks for each branch |
| Function coverage | 95% | 98% | 100% | Add Describe block for each untested function |
| Test pass rate | 99% | 99.5% | 100% | Fix failing assertions and mock setup |
| Avg test duration | <10s | <5s | <2s | Share mocks, reduce I/O, parallelize |
| Flaky test rate | <2% | <1% | 0% | Replace timing deps with mocks |

## Phase 1: Diagnose Coverage Gaps

```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Run.PassThru = $true
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$result = Invoke-Pester -Configuration $config

# Group missed commands by file
$missed = $result.CodeCoverage.CommandsMissed
$grouped = $missed | Group-Object File | Sort-Object Count -Descending

foreach ($file in $grouped) {
    Write-Host "`n--- $($file.Name) ($($file.Count) uncovered lines) ---"
    $file.Group | ForEach-Object {
        Write-Host "  L$($_.Line): $($_.Command)"
    }
}
```

## Phase 2: Generate Targeted Tests for Each Gap Type

### Gap: Untested Error Path (catch block)
```powershell
Context 'When API call fails' {
    BeforeAll {
        Mock Get-AzResource { throw 'Service unavailable' }
    }
    It 'Throws meaningful error' {
        { Get-ResourceStatus -Name 'test' } | Should -Throw '*unavailable*'
    }
    It 'Does not call downstream functions' {
        Should -Invoke Process-Resource -Times 0
    }
}
```

### Gap: Untested Branch (if/else)
```powershell
Context 'When resource does not exist' {
    BeforeAll {
        Mock Get-AzResource { $null }  # Triggers the else branch
    }
    It 'Returns not-found status' {
        $result = Get-ResourceStatus -Name 'missing'
        $result.Status | Should -Be 'NotFound'
    }
}
```

### Gap: Untested Switch Cases
```powershell
It 'Handles all severity levels' -TestCases @(
    @{ Severity = 'Critical'; Expected = 1 }
    @{ Severity = 'Warning';  Expected = 2 }
    @{ Severity = 'Info';     Expected = 3 }
) {
    Get-SeverityCode -Severity $Severity | Should -Be $Expected
}
```

### Gap: Untested Private/Internal Function
```powershell
InModuleScope 'MyModule' {
    Describe 'Internal: Format-OutputRecord' {
        It 'Formats record with timestamp' {
            $result = Format-OutputRecord -Data @{ Name = 'test' }
            $result.Timestamp | Should -Not -BeNullOrEmpty
        }
    }
}
```

### Gap: Untested Pipeline Input
```powershell
Context 'Pipeline input' {
    It 'Processes multiple items from pipeline' {
        $items = @('item1', 'item2', 'item3')
        $results = $items | Get-ProcessedItem
        $results.Count | Should -Be 3
    }
}
```

## Phase 3: Fix Failing Tests

### Common Failures and Fixes

| Failure Message | Root Cause | Fix |
|----------------|------------|-----|
| `Expected 'X' but got $null` | Mock not returning value | Add return object to Mock: `Mock Fn { @{...} }` |
| `CommandNotFoundException` | Source not dot-sourced | Add `. $PSScriptRoot/../src/Fn.ps1` to BeforeAll |
| `Cannot bind parameter` | Wrong parameter type | Check parameter types, use correct test data |
| `Mock was called 0 times` | Function not calling the mock | Verify function actually calls the mocked cmdlet |
| `Expected Throw but no exception` | ErrorAction not Stop | Add `-ErrorAction Stop` in source function |
| `Cannot find module` | Module not imported | Add `Import-Module ./src/MyModule.psd1` to BeforeAll |

## Phase 4: Eliminate Flaky Tests

### Replace Timing Dependencies
```powershell
# BEFORE (flaky — depends on actual time)
It 'Returns recent items' {
    $result = Get-RecentItems -Hours 24
    $result | Should -Not -BeNullOrEmpty
}

# AFTER (deterministic — mocked time)
It 'Returns recent items' {
    Mock Get-Date { [DateTime]'2026-04-10T12:00:00' }
    $result = Get-RecentItems -Hours 24
    $result | Should -Not -BeNullOrEmpty
}
```

### Fix Order Dependencies
```powershell
# Ensure each Context has complete setup — no reliance on other tests
Context 'Scenario A' {
    BeforeAll {
        # COMPLETE mock setup for this scenario
        Mock Get-AzResource { @{ Name = 'res1' } }
        Mock Get-AzContext { @{ Subscription = @{ Id = '...' } } }
    }
    # Tests here are fully isolated
}
```

## Phase 5: Optimize Test Performance

### Share Expensive Mocks at Describe Level
```powershell
Describe 'Get-AllResources' -Tag 'Unit' {
    BeforeAll {
        # SHARED — set up once for all Contexts
        Mock Connect-AzAccount { }
        Mock Get-AzContext { @{ Subscription = @{ Id = '...' } } }
    }

    Context 'Specific scenario' {
        BeforeAll {
            # SCENARIO-SPECIFIC — override only what changes
            Mock Get-AzResource { @{ Name = 'test' } }
        }
    }
}
```

### Minimize File I/O
```powershell
# Use TestDrive (RAM-backed) instead of real file system
BeforeAll {
    Set-Content "TestDrive:/data.json" '{"items":[1,2,3]}'
}
```

### Configure Parallel Test Containers
```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
# Each .Tests.ps1 file runs as a separate container (parallelizable in CI)
```

## Phase 6: Coverage Trending

Track coverage over time to prevent regression:

```powershell
# Compare current vs baseline
$baseline = 90.0  # Last known good coverage
$current = $pct   # From Invoke-Pester result

if ($current -lt $baseline) {
    Write-Error "Coverage REGRESSION: $current% < baseline $baseline%"
} elseif ($current -gt $baseline) {
    Write-Host "Coverage IMPROVED: $current% (was $baseline%)"
} else {
    Write-Host "Coverage STABLE: $current%"
}
```

## Output: Tuning Report

```
## Tuning Report
| Action                    | Before | After | Change |
|---------------------------|--------|-------|--------|
| Line coverage             | 78%    | 93%   | +15%   |
| Branch coverage           | 65%    | 85%   | +20%   |
| Failing tests             | 3      | 0     | Fixed  |
| Flaky tests               | 2      | 0     | Fixed  |
| Avg test duration          | 4.2s   | 1.8s  | -57%   |
| New tests generated       | —      | 12    | Added  |
```
