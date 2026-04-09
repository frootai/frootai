---
description: "Review prompt for Play 101 — Review Pester test suite code quality"
---

# /review — Play 101: Pester Test Development

## Purpose
Review the Pester test suite for adherence to best practices, completeness, and quality.

## Review Checklist

### Test Structure
- [ ] All exported functions have test files (.Tests.ps1)
- [ ] BeforeAll uses dot-sourcing (not script-scope import)
- [ ] Describe/Context/It hierarchy is clean (max 3 levels)
- [ ] Test names are descriptive (verb-first: Returns, Throws, Creates)
- [ ] Tags applied: -Tag 'Unit' or -Tag 'Integration'
- [ ] No duplicate test logic (use -TestCases/-ForEach instead)

### Mock Quality
- [ ] All Azure cmdlets mocked (Connect-AzAccount, Get-AzContext, etc.)
- [ ] All file system operations use TestDrive
- [ ] Mock return types are realistic (match real cmdlet output)
- [ ] ParameterFilter used for conditional behavior
- [ ] Every Mock has Should -Invoke verification
- [ ] No mock of the function under test

### Assertion Quality
- [ ] Should operators used correctly (-Be, -BeExactly, -Throw, -Invoke)
- [ ] Not using Should -Be $true (use Should -BeTrue)
- [ ] -Throw includes error message pattern
- [ ] One assertion per It block (focused tests)
- [ ] Error paths tested (try/catch coverage)

### Coverage
- [ ] Line coverage ≥90%
- [ ] Branch coverage ≥80%
- [ ] Function coverage = 100%
- [ ] Edge cases: $null, empty, boundary values

### Security
- [ ] No credentials in test files
- [ ] RBAC scope validated in policy tests
- [ ] Test data sanitized (no production data)

### CI/CD
- [ ] Invoke-Pester configuration defined
- [ ] JaCoCo + NUnit output configured
- [ ] Coverage gate set (fail at <90%)
- [ ] Pipeline YAML valid
