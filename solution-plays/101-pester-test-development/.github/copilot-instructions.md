---
description: "Pester 5.x test development knowledge — auto-injected into every Copilot conversation in this workspace"
---

# Pester 5.x Test Development — Domain Knowledge

This workspace is configured for PowerShell Pester test development. The following rules supplement your existing knowledge with Pester 5.x specifics, common pitfalls, and project conventions.

## Pester 5.x Syntax (Critical — Differs from Pester 4.x)

| Correct (Pester 5.x) | Wrong (Pester 4.x / common mistakes) |
|---------|-------|
| `BeforeAll { . $PSScriptRoot/../src/Fn.ps1 }` | Script-scope dot-sourcing |
| `Should -Be` | `Should Be` (no dash — Pester 4 syntax) |
| `Should -Invoke X -Times 1 -Exactly -Scope Context` | `Should -Invoke` without `-Scope Context` (misses BeforeAll calls) |
| `Should -Invoke -Times 1 -Exactly` | `Assert-MockCalled` (deprecated in 5.x) |
| `Should -BeTrue` | `Should -Be $true` |
| `Should -BeNullOrEmpty` | `Should -Be $null` |
| `Should -Throw '*pattern*'` | `Should -Throw` (without error pattern) |
| `Describe 'X' -Tag 'Unit'` | Describe without tags |
| `-TestCases @(...)` or `-ForEach` | Copy-paste It blocks for variations |
| `@($grouped).Count` | `$grouped.Count` (single GroupInfo returns item count, not group count) |

## Critical Pitfalls (Discovered in Production Testing)

### Pitfall 1: Should -Invoke Reports 0 Calls
`Should -Invoke` defaults to `It` scope — it can't see function calls made in `BeforeAll`. Always add `-Scope Context`:
```powershell
# ❌ WRONG — reports 0 invocations
It 'Calls Get-AzResource' { Should -Invoke Get-AzResource -Times 1 -Exactly }

# ✅ CORRECT — sees calls from BeforeAll
It 'Calls Get-AzResource' { Should -Invoke Get-AzResource -Times 1 -Exactly -Scope Context }
```

### Pitfall 2: exit Keyword Crashes Pester
`exit` is a PowerShell keyword, not a command — it cannot be mocked. If source code contains `exit 0` or `exit 1`, it will terminate the Pester test runner.
- When extracting functions via AST, replace `exit N` with `throw "Exit code: N"` or `return`
- When dot-sourcing scripts with top-level `exit`, use AST extraction instead

### Pitfall 3: Scripts With Top-Level Code Can't Be Dot-Sourced
Scripts with 300+ lines of inline `Write-Host`/`Read-Host` execute on import when dot-sourced. Use AST extraction to load only function definitions:
```powershell
BeforeAll {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        "$PSScriptRoot/../src/LargeScript.ps1", [ref]$null, [ref]$null)
    $functions = $ast.FindAll({ $args[0] -is [FunctionDefinitionAst] }, $true)
    foreach ($fn in $functions) { Invoke-Expression $fn.Extent.Text }
}
```

### Pitfall 4: Group-Object Single-Result .Count
When `Group-Object` returns a single group, `.Count` returns the number of items IN that group, not 1. Always wrap in `@()`:
```powershell
# ❌ WRONG — if 1 group with 5 items, returns 5
$groups = $data | Group-Object Type
$groups.Count  # Returns 5 (items), not 1 (group)

# ✅ CORRECT — always returns group count
@($data | Group-Object Type).Count  # Returns 1
```

## Mock Conventions

- **Always mock authentication**: `Mock Connect-AzAccount { }` and `Mock Get-AzContext { @{...} }`
- **File I/O** → use `TestDrive:` (isolated PSDrive, auto-cleaned per Describe)
- **Registry** → use `TestRegistry:` (isolated hive)
- **Conditional mocks** → `Mock X -ParameterFilter { $Name -eq 'test' } { return @{...} }`
- **Verify every mock**: `Should -Invoke X -Times 1 -Exactly` (never leave mocks unverified)
- **Never mock the function under test** — only mock its dependencies

## Coverage Targets

| Metric | Target | Output Format |
|--------|--------|---------------|
| Line coverage | ≥ 90% | JaCoCo XML → `./reports/coverage.xml` |
| Branch coverage | ≥ 80% | (included in JaCoCo) |
| Function coverage | 100% | (included in JaCoCo) |
| Test results | — | NUnit XML → `./reports/test-results.xml` |

## File Naming Convention

- Source: `Get-ServerHealth.ps1` → Test: `Get-ServerHealth.Tests.ps1`
- One test file per source file — no monolithic test files
- Tests in `./tests/` directory (parallel to `./src/`)

## PowerShell Coding Standards (for generated/refactored code)

- Always use `[CmdletBinding()]` and `[OutputType()]` on functions
- Use `[Parameter(Mandatory)]` with `ValidateSet`, `ValidateNotNullOrEmpty` as needed
- Use approved verbs: Get, Set, New, Remove, Invoke, Test
- Use `Write-Verbose` / `Write-Debug` for diagnostics (never `Write-Host` in testable code)
- Handle errors with `try/catch` and `-ErrorAction Stop`

## Legacy Code Refactoring (when source is untestable)

If source functions use `Write-Host`, `Read-Host`, `$global:`, hardcoded paths, or lack `function` keywords — refactor before testing:
- `Write-Host "msg"` → `Write-Verbose "msg"` or return structured output
- `Read-Host "prompt"` → add `param()` with default value
- Inline scripts → extract into functions with `[CmdletBinding()]`
- `"C:\App\config.json"` → `param([string]$ConfigPath = "C:\App\config.json")`

## Available Specialist Agents (optional — use when needed)

| Agent | Use For |
|-------|---------|
| `@builder` | Generate Pester tests when you want the full pipeline (discovery → mocks → tests) |
| `@reviewer` | Audit existing tests for mock completeness, assertion quality, coverage gaps |
| `@tuner` | Fix failing tests, close coverage gaps, eliminate flaky tests |

These agents have detailed skills in `.github/skills/` — they'll load them automatically.

## Available Slash Commands

| Command | Action |
|---------|--------|
| `/test` | Run Invoke-Pester with coverage |
| `/review` | Review test quality |
| `/deploy` | Set up CI/CD pipeline |
| `/evaluate` | Analyze coverage gaps |

## CI/CD Templates (in `.github/workflows/`)

Ready-to-use pipeline templates exist for GitHub Actions and Azure DevOps. Reference them when setting up CI/CD instead of writing YAML from scratch.
