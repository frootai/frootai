---
description: "Security patterns for Pester test development — mock isolation, credential safety, test data sanitization, RBAC scope validation"
applyTo: "solution-plays/101-pester-test-development/**/*.{ps1,Tests.ps1}"
waf: ["security", "reliability"]
---

# Security Patterns for Pester Test Development

## Mock Isolation — Prevent Real API Calls

### Azure Cmdlets
Every test file MUST mock authentication cmdlets to prevent real Azure API calls:
```powershell
BeforeAll {
    Mock Connect-AzAccount { }
    Mock Get-AzContext { @{ Subscription = @{ Id = '00000000-0000-0000-0000-000000000000'; Name = 'test-sub' } } }
}
```

### Network Calls
Mock all outbound network calls:
```powershell
Mock Invoke-RestMethod { @{ status = 'ok' } }
Mock Invoke-WebRequest { @{ StatusCode = 200; Content = '{"ok":true}' } }
Mock Test-NetConnection { @{ TcpTestSucceeded = $true } }
```

### File System
Use TestDrive for all file operations:
```powershell
# Creates isolated PSDrive that's cleaned up after each Describe
Set-Content "TestDrive:/config.json" '{"key":"value"}'
$result = Get-Config -Path "TestDrive:/config.json"
```

## Credential Safety

### No Secrets in Test Files
```powershell
It 'Source code does not contain hardcoded credentials' {
    $files = Get-ChildItem -Path ./src -Filter *.ps1 -Recurse
    foreach ($file in $files) {
        $content = Get-Content $file.FullName -Raw
        $content | Should -Not -Match 'password\s*=\s*[\x27\x22][^\x27\x22]+[\x27\x22]'
        $content | Should -Not -Match 'ConvertTo-SecureString\s+[\x27\x22][^\x27\x22]+'
        $content | Should -Not -Match '[a-f0-9]{32,}'  # Potential API keys
    }
}
```

### Mock Credentials
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
- Never include real subscription IDs — use all-zeros GUID
- Never include real resource names — use 'test-*' prefix
- Clean up test data in AfterAll blocks

## Security Review Checklist
- [ ] All Az.* cmdlets mocked (no real Azure API calls)
- [ ] No credentials in test files (no passwords, keys, tokens)
- [ ] TestDrive used for file operations (no real filesystem changes)
- [ ] TestRegistry used for registry operations (no real registry changes)
- [ ] Network calls mocked (no real HTTP/HTTPS requests)
- [ ] Test data is synthetic (no production PII or business data)
- [ ] RBAC scope validated in policy assignment tests
- [ ] Mock parameters validated (ParameterFilter prevents injection)
