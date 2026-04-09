---
description: "Security patterns for Pester testing — mock isolation, credential safety, TestDrive isolation, RBAC scope validation, test data sanitization"
applyTo: "**/*.{ps1,psm1,psd1,Tests.ps1}"
waf: ["security", "reliability"]
---

# Security Patterns for Pester Test Development

## Mock Isolation — Prevent Real API Calls

### Azure Cmdlets (Always Mock)
```powershell
BeforeAll {
    Mock Connect-AzAccount { }
    Mock Get-AzContext { @{ Subscription = @{ Id = '00000000-0000-0000-0000-000000000000' } } }
}
```

### Network Calls
```powershell
Mock Invoke-RestMethod { @{ status = 'ok' } }
Mock Invoke-WebRequest { @{ StatusCode = 200; Content = '{"ok":true}' } }
Mock Test-NetConnection { @{ TcpTestSucceeded = $true } }
```

### File System → TestDrive
```powershell
Set-Content "TestDrive:/config.json" '{"key":"value"}'
$result = Get-Config -Path "TestDrive:/config.json"
```

## Credential Safety
- Never include real API keys, passwords, or connection strings in test files
- Mock all authentication cmdlets (Connect-AzAccount, Get-Credential)
- Use synthetic subscription IDs (all-zeros GUID)
- Use 'test-*' prefix for all resource names

```powershell
Mock Get-Credential { [PSCredential]::new('testuser', (ConvertTo-SecureString 'mock' -AsPlainText -Force)) }
Mock Get-AzKeyVaultSecret { @{ SecretValue = ConvertTo-SecureString 'mock-secret' -AsPlainText -Force } }
```

## RBAC Scope Validation
```powershell
It 'Policy assignment targets management group scope only' {
    $assignment = New-PolicyAssignment -PolicyName 'test' -Scope '/providers/Microsoft.Management/managementGroups/mg-root'
    $assignment.Scope | Should -Match '^/providers/Microsoft.Management/managementGroups/'
    $assignment.Scope | Should -Not -Match '/subscriptions/'
}
```

## Test Data Sanitization
- Never use production data in tests — use synthetic test data
- Never include real subscription IDs
- Never include real resource names — use 'test-*' prefix
- Clean up test data in AfterAll blocks

## Security Review Checklist
- [ ] All Az.* cmdlets mocked (no real API calls)
- [ ] No credentials in test files
- [ ] TestDrive used for file operations
- [ ] TestRegistry used for registry operations
- [ ] Network calls mocked
- [ ] Test data is synthetic
- [ ] RBAC scope validated in policy tests
- [ ] Mock parameters validated (ParameterFilter)
