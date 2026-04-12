---
mode: "agent"
description: "Evaluate prompt for Play 101 — Evaluate Pester test suite quality metrics"
agent: "tuner"
tools: ["terminal", "file", "search"]
---

# /evaluate — Play 101: Pester Test Development

## Purpose
Evaluate the quality and completeness of the Pester test suite against the source codebase.

## Metrics to Evaluate

### 1. Test Pass Rate
```powershell
$result = Invoke-Pester -Path ./tests -PassThru
$passRate = $result.PassedCount / $result.TotalCount * 100
Write-Host "Pass rate: $passRate% ($($result.PassedCount)/$($result.TotalCount))"
# Target: 100%
```

### 2. Code Coverage
```powershell
$config = New-PesterConfiguration
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.Run.Path = './tests'
$config.Run.PassThru = $true
$result = Invoke-Pester -Configuration $config
$covered = $result.CodeCoverage.CommandsExecutedCount
$total = $result.CodeCoverage.CommandsAnalyzedCount
$pct = [math]::Round($covered / $total * 100, 1)
Write-Host "Coverage: $pct% ($covered/$total commands)"
# Target: ≥90% line coverage
```

### 3. Mock Verification
Check that every Mock has a corresponding Should -Invoke:
- Count Mock definitions per test file
- Count Should -Invoke assertions per test file
- Flag any unverified mocks (Mock without -Invoke)

### 4. Test Execution Time
```powershell
$result.Tests | Sort-Object Duration -Descending | Select-Object -First 10 |
    ForEach-Object { Write-Host "$($_.Duration) — $($_.Name)" }
# Target: No test >5s, total suite <60s
```

### 5. Flaky Test Detection
Run suite 3 times, compare results:
```powershell
$runs = 1..3 | ForEach-Object { Invoke-Pester -Path ./tests -PassThru }
$flaky = $runs[0].Tests | Where-Object {
    $name = $_.Name
    ($runs | ForEach-Object { ($_.Tests | Where-Object Name -eq $name).Result }) | Select-Object -Unique | Measure-Object | Where-Object Count -gt 1
}
# Target: 0 flaky tests
```

## Failure Remediation
| Issue | Cause | Fix |
|-------|-------|-----|
| Low pass rate | Mock setup incorrect | Verify mock return types match real cmdlet output |
| Low coverage | Missing edge case tests | Add tests for uncovered branches (if/else, catch) |
| Slow tests | Heavy mock initialization | Move shared mocks to Describe-level BeforeAll |
| Flaky tests | Timing or state dependencies | Mock time-dependent calls, ensure test isolation |
| Unverified mocks | Missing Should -Invoke | Add -Invoke assertion for every Mock definition |
