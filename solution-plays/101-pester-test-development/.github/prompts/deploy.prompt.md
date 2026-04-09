---
description: "Deploy prompt for Play 101 — Deploy Pester test suite to target project and configure CI/CD pipeline"
---

# /deploy — Play 101: Pester Test Development

## Purpose
Deploy the generated Pester test suite to the target PowerShell project and configure CI/CD pipeline for automated testing.

## Prerequisites
- PowerShell 7.2+ installed (or Windows PowerShell 5.1)
- Pester 5.5+ installed: `Install-Module Pester -Force`
- Target project source code accessible
- CI/CD platform available (Azure DevOps or GitHub Actions)

## Steps

### 1. Copy Test Files
Copy generated *.Tests.ps1 files to the target project:
```powershell
Copy-Item -Path ./generated-tests/*.Tests.ps1 -Destination $targetProject/tests/ -Recurse
Copy-Item -Path ./test-helpers/*.ps1 -Destination $targetProject/tests/Helpers/ -Recurse
```

### 2. Validate Tests Pass Locally
```powershell
$config = New-PesterConfiguration
$config.Run.Path = './tests'
$config.Output.Verbosity = 'Detailed'
$config.Run.PassThru = $true
$result = Invoke-Pester -Configuration $config
if ($result.FailedCount -gt 0) { throw "$($result.FailedCount) tests failed" }
```

### 3. Verify Coverage Meets Threshold
```powershell
$config.CodeCoverage.Enabled = $true
$config.CodeCoverage.Path = './src'
$config.CodeCoverage.CoveragePercentTarget = 90
$config.Run.Exit = $true
Invoke-Pester -Configuration $config
```

### 4. Configure CI/CD Pipeline
- Azure DevOps: Add PowerShell@2 task with Invoke-Pester, publish test results (NUnit) and coverage (JaCoCo)
- GitHub Actions: Add pwsh step, upload-artifact for reports
- Set coverage gate: fail build if <90%

### 5. Verify Pipeline Execution
- Trigger pipeline manually or via PR
- Confirm all tests pass in pipeline
- Confirm coverage report published
- Confirm test results visible in PR

## Verification
- [ ] All tests pass locally (Invoke-Pester exit code 0)
- [ ] Code coverage ≥90% (JaCoCo report confirms)
- [ ] CI/CD pipeline configured and tested
- [ ] Test results published to build artifacts
- [ ] Coverage report visible in pipeline summary
