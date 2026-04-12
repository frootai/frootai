---
mode: "agent"
description: "Test prompt for Play 101 — Run Pester test suite with coverage"
agent: "builder"
tools: ["terminal", "file", "search"]
---

# /test — Play 101: Pester Test Development

## Purpose
Run the Pester test suite with full coverage analysis and report generation.

## Quick Run (Verbose Output)
```powershell
Invoke-Pester -Path ./tests -Output Detailed
```

## Full Run (Coverage + Reports)
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

## Selective Run (By Tag)
```powershell
# Unit tests only
Invoke-Pester -Path ./tests -Tag 'Unit' -Output Detailed

# Integration tests only
Invoke-Pester -Path ./tests -Tag 'Integration' -Output Detailed

# Exclude slow tests
Invoke-Pester -Path ./tests -ExcludeTag 'Slow' -Output Detailed
```

## Selective Run (By File)
```powershell
# Test specific function
Invoke-Pester -Path ./tests/Get-PolicyCompliance.Tests.ps1 -Output Detailed
```

## Coverage Analysis
```powershell
$result = Invoke-Pester -Path ./tests -CodeCoverage ./src -PassThru

# Summary
Write-Host "Tests: $($result.PassedCount) passed, $($result.FailedCount) failed"
Write-Host "Coverage: $([math]::Round($result.CodeCoverage.CommandsExecutedCount / $result.CodeCoverage.CommandsAnalyzedCount * 100, 1))%"

# Uncovered files
$result.CodeCoverage.CommandsMissed | Group-Object File | Sort-Object Count -Descending |
    ForEach-Object { Write-Host "  $($_.Count) uncovered in $($_.Name)" }
```

## Expected Output
```
Starting discovery in 1 files.
Found 42 tests. 156ms
Running tests.
Describing Get-PolicyCompliance
  Context When policy is compliant
    [+] Returns compliant status 12ms (8ms|4ms)
    [+] Calls Get-AzPolicyState exactly once 5ms (3ms|2ms)
  Context When policy is non-compliant
    [+] Returns non-compliant with resource details 8ms (5ms|3ms)
Tests completed in 1.2s
Tests Passed: 42, Failed: 0, Skipped: 0
Code Coverage: 94.2% (target 90.0%)
```

## Troubleshooting
| Issue | Fix |
|-------|-----|
| "Function not found" | Check BeforeAll dot-source path matches source file location |
| "Mock not invoked" | Verify MockWith returns expected type, check ParameterFilter |
| Coverage <90% | Run with -PassThru, analyze CommandsMissed for uncovered lines |
| Test timeout | Add -Timeout parameter to Invoke-Pester Configuration |
