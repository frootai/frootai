---
name: evaluate-pester-test-development
description: "Evaluate Pester test quality — analyze code coverage gaps, check mock completeness, detect flaky tests, verify test isolation, measure execution time, generate coverage reports. Use when: evaluate tests, check coverage, find gaps, test quality, flaky tests, coverage report, audit tests, review test suite."
---

# Evaluate Pester Test Suite Quality

## When to Use
- User asks to evaluate, audit, or assess test quality
- User asks about coverage gaps or uncovered code
- User asks to check mock completeness or test isolation
- User mentions flaky tests, test reliability, or test performance
- User says "evaluate", "audit", "check coverage", "find gaps"

## Evaluation Dimensions

| Dimension | What We Check | Target |
|-----------|--------------|--------|
| Coverage | Line, branch, function % | ≥90% line, ≥80% branch, 100% function |
| Mock completeness | Every external call has a Mock + Should -Invoke | 100% |
| Assertion quality | Correct Should operators, one assertion per It | No false positives |
| Test isolation | No shared state, no order dependency | All tests independent |
| Flaky detection | Same result on 3 consecutive runs | 0 flaky tests |
| Performance | Execution time per Describe block | < 5s per block |
| Naming | Descriptive verb-first It names, matching file names | 100% compliance |

## Step 1: Run Tests with PassThru

```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Run.PassThru = $true
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.CodeCoverage.OutputFormat = 'JaCoCo'
$config.CodeCoverage.OutputPath = './reports/coverage.xml'
$config.TestResult.Enabled = $true
$config.TestResult.OutputFormat = 'NUnitXml'
$config.TestResult.OutputPath = './reports/test-results.xml'
$config.Output.Verbosity = 'Detailed'
$result = Invoke-Pester -Configuration $config
```

## Step 2: Coverage Gap Analysis

```powershell
# Identify uncovered lines
$missed = $result.CodeCoverage.CommandsMissed
$grouped = $missed | Group-Object File | Sort-Object Count -Descending

foreach ($file in $grouped) {
    Write-Host "`nUNCOVERED: $($file.Name) — $($file.Count) lines"
    $file.Group | ForEach-Object {
        Write-Host "  Line $($_.Line): $($_.Command)"
    }
}

# Coverage summary
$hit = $result.CodeCoverage.CommandsExecutedCount
$total = $hit + $result.CodeCoverage.CommandsMissedCount
$pct = [math]::Round(($hit / $total) * 100, 1)
Write-Host "`nOverall coverage: $pct% ($hit/$total lines)"
```

### Common Gap Patterns

| Gap Type | How to Identify | How to Fix |
|----------|----------------|-----------|
| Untested error path | `catch` block in CommandsMissed | Add It with Mock that throws: `Mock X { throw 'error' }` |
| Untested branch | `if/else` branch in CommandsMissed | Add Context with Mock that triggers the branch |
| Untested switch case | `switch` case in CommandsMissed | Add `-TestCases @(@{Case='value1'}, @{Case='value2'})` |
| Untested helper | Private function in CommandsMissed | Add `InModuleScope` Describe block |
| Untested parameter set | ParameterSetName path missed | Add It for each parameter set combination |

## Step 3: Mock Completeness Check

Scan test files for mock quality:

```powershell
# Find all Mocks
$mocks = Select-String -Path ./tests/*.Tests.ps1 -Pattern 'Mock\s+(\S+)' |
    ForEach-Object { $_.Matches.Groups[1].Value } | Sort-Object -Unique

# Find all Should -Invoke verifications
$verified = Select-String -Path ./tests/*.Tests.ps1 -Pattern 'Should\s+-Invoke\s+(\S+)' |
    ForEach-Object { $_.Matches.Groups[1].Value } | Sort-Object -Unique

# Unverified mocks (Mock exists but no Should -Invoke)
$unverified = $mocks | Where-Object { $_ -notin $verified }
if ($unverified) {
    Write-Warning "Mocks without Should -Invoke verification:"
    $unverified | ForEach-Object { Write-Warning "  $_" }
}
```

### Mock Quality Checklist
- [ ] Every `Mock` has a matching `Should -Invoke -Times N -Exactly`
- [ ] `Connect-AzAccount` and `Get-AzContext` mocked in every Azure test
- [ ] Mock return types match actual cmdlet output shapes
- [ ] `ParameterFilter` used for conditional behavior (not blanket mocks)
- [ ] Mocks scoped correctly: Describe-level (shared) vs Context-level (scenario)
- [ ] No mock of the function under test — only its dependencies

## Step 4: Flaky Test Detection

```powershell
# Run tests 3x and compare results
$results = 1..3 | ForEach-Object {
    $config = New-PesterConfiguration
    $config.Run.Path = './tests'
    $config.Run.PassThru = $true
    $config.Output.Verbosity = 'None'
    Invoke-Pester -Configuration $config
}

# Compare pass/fail status for each test
$testNames = $results[0].Tests.Name
foreach ($name in $testNames) {
    $statuses = $results | ForEach-Object {
        ($_.Tests | Where-Object { $_.Name -eq $name }).Result
    }
    if (($statuses | Sort-Object -Unique).Count -gt 1) {
        Write-Warning "FLAKY: $name — results: $($statuses -join ', ')"
    }
}
```

### Common Flaky Causes
| Cause | Detection | Fix |
|-------|-----------|-----|
| Timing dependency | `Start-Sleep` in test | Mock `Get-Date`, remove sleeps |
| Order dependency | Test fails when run alone | Ensure proper BeforeAll/BeforeEach setup |
| Environment leak | Test reads `$env:` variables | Mock environment access |
| File system race | Parallel tests write same file | Use TestDrive (isolated per Describe) |

## Step 5: Test Isolation Verification

Check that tests are truly independent:
- [ ] No `$script:` or `$global:` variables shared between Describe blocks
- [ ] Each Describe has its own BeforeAll setup (not inherited)
- [ ] TestDrive used for file operations (auto-cleaned per Describe)
- [ ] No real network, file system, or registry operations
- [ ] Tests pass when run individually: `Invoke-Pester -Path ./tests/X.Tests.ps1`
- [ ] Tests pass in random order (shuffle)

## Step 6: Performance Profiling

```powershell
$result = Invoke-Pester -Path './tests' -PassThru
$result.Containers | ForEach-Object {
    $_.Blocks | ForEach-Object {
        Write-Host "$($_.Name): $([math]::Round($_.Duration.TotalSeconds, 2))s"
    }
} | Sort-Object -Descending
```

Flag any Describe block > 5 seconds for optimization.

## Output: Test Quality Report

Generate a structured quality report:
```
## Test Quality Evaluation Report
| Metric             | Result  | Target  | Status |
|--------------------|---------|---------|--------|
| Line coverage      | 93.2%   | ≥90%    | PASS   |
| Branch coverage    | 85.1%   | ≥80%    | PASS   |
| Function coverage  | 100%    | 100%    | PASS   |
| Mock completeness  | 100%    | 100%    | PASS   |
| Flaky tests        | 0       | 0       | PASS   |
| Avg test duration  | 1.8s    | <5s     | PASS   |
| Test isolation     | OK      | Independent | PASS |
```
