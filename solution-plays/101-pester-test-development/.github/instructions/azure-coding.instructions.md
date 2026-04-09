---
description: "Azure PowerShell testing patterns — mocking Az cmdlets, testing Azure Policy lifecycle, DiagnosticLogs validation, remediation testing"
applyTo: "**/*.{ps1,psm1,psd1,Tests.ps1}"
waf: ["reliability", "operational-excellence"]
---

# Azure PowerShell Testing Patterns

## Mocking Azure Cmdlets in Pester

### Authentication (Always Mock)
```powershell
BeforeAll {
    Mock Connect-AzAccount { }
    Mock Get-AzContext {
        [PSCustomObject]@{
            Account = @{ Id = 'test@contoso.com' }
            Subscription = @{ Id = '00000000-0000-0000-0000-000000000000'; Name = 'test-sub' }
            Tenant = @{ Id = '00000000-0000-0000-0000-000000000001' }
        }
    }
}
```

### Policy Definition Testing
```powershell
Mock Get-AzPolicyDefinition {
    [PSCustomObject]@{
        Name = 'nsg-diagnostics'
        ResourceId = '/providers/Microsoft.Authorization/policyDefinitions/nsg-diagnostics'
        Properties = [PSCustomObject]@{
            PolicyType = 'Custom'
            Mode = 'All'
            DisplayName = 'Configure NSG Diagnostic Logs'
            PolicyRule = @{
                if = @{ field = 'type'; equals = 'Microsoft.Network/networkSecurityGroups' }
                then = @{ effect = 'DeployIfNotExists' }
            }
        }
    }
}
```

### Policy Assignment Testing
```powershell
Mock New-AzPolicyAssignment {
    [PSCustomObject]@{
        PolicyAssignmentId = '/providers/Microsoft.Authorization/policyAssignments/test'
        Properties = @{
            PolicyDefinitionId = '/providers/Microsoft.Authorization/policyDefinitions/nsg-diagnostics'
            Scope = '/providers/Microsoft.Management/managementGroups/BASF_ManagementRoot'
        }
    }
}
```

### Policy Compliance State
```powershell
Mock Get-AzPolicyState -ParameterFilter { $PolicyDefinitionName -eq 'nsg-diagnostics' } {
    [PSCustomObject]@{
        ComplianceState = 'Compliant'
        ResourceId = '/subscriptions/test/resourceGroups/rg1/providers/Microsoft.Network/networkSecurityGroups/nsg1'
        PolicyDefinitionName = 'nsg-diagnostics'
    }
}
```

### Remediation Testing
```powershell
Mock Start-AzPolicyRemediation {
    [PSCustomObject]@{ Name = 'remediation-001'; ProvisioningState = 'Accepted' }
}
Mock Get-AzPolicyRemediation {
    [PSCustomObject]@{
        Name = 'remediation-001'; ProvisioningState = 'Succeeded'
        DeploymentSummary = @{ TotalDeployments = 5; SuccessfulDeployments = 5; FailedDeployments = 0 }
    }
}
```

### DiagnosticLogs NSG Policy
```powershell
Describe 'NSG DiagnosticLogs Policy' -Tag 'Integration' {
    BeforeAll {
        Mock Get-AzNetworkSecurityGroup { [PSCustomObject]@{ Id = '/sub/test/rg/rg1/nsg/nsg1'; Name = 'nsg1' } }
        Mock Set-AzDiagnosticSetting { [PSCustomObject]@{ Name = 'service' } }
        Mock Get-AzDiagnosticSetting { $null }
    }

    It 'Configures diagnostic settings on new NSG' {
        Set-NsgDiagnosticPolicy -NsgName 'nsg1' -WorkspaceId '/sub/ee5f8667/.../workspaces/monitoring'
        Should -Invoke Set-AzDiagnosticSetting -Times 1 -Exactly
    }

    It 'Sets correct categories (Event + RuleCounter)' {
        Set-NsgDiagnosticPolicy -NsgName 'nsg1' -WorkspaceId '/sub/ee5f8667/.../workspaces/monitoring'
        Should -Invoke Set-AzDiagnosticSetting -ParameterFilter {
            $Category -contains 'NetworkSecurityGroupEvent' -and
            $Category -contains 'NetworkSecurityGroupRuleCounter'
        }
    }

    Context 'Remediation needed' {
        BeforeAll {
            Mock Get-AzDiagnosticSetting { [PSCustomObject]@{ Name = 'wrong' } }
            Mock Start-AzPolicyRemediation { [PSCustomObject]@{ ProvisioningState = 'Accepted' } }
        }

        It 'Triggers remediation for incorrect settings' {
            Invoke-PolicyRemediation -PolicyName 'nsg-diagnostics' -Scope 'BASF_ManagementRoot'
            Should -Invoke Start-AzPolicyRemediation -Times 1 -Exactly
        }
    }
}
```

## JSON Policy File Validation
```powershell
BeforeDiscovery {
    $policyFiles = Get-ChildItem -Path './policies/definitions' -Filter '*.json' -ErrorAction SilentlyContinue
    $testCases = @()
    if ($policyFiles) { $testCases = $policyFiles | ForEach-Object { @{ Name = $_.BaseName; Path = $_.FullName } } }
}

Describe 'Policy Definition JSON' -Tag 'Unit' {
    It '<Name> is valid JSON' -ForEach $testCases {
        { Get-Content $Path -Raw | ConvertFrom-Json } | Should -Not -Throw
    }
    It '<Name> has required properties' -ForEach $testCases {
        $policy = Get-Content $Path -Raw | ConvertFrom-Json
        $policy.properties.policyType | Should -Be 'Custom'
        $policy.properties.displayName | Should -Not -BeNullOrEmpty
        $policy.properties.policyRule | Should -Not -BeNullOrEmpty
    }
    It '<Name> has valid effect' -ForEach $testCases {
        $policy = Get-Content $Path -Raw | ConvertFrom-Json
        $policy.properties.policyRule.then.effect | Should -BeIn @('Audit','Deny','DeployIfNotExists','Modify','AuditIfNotExists','Disabled')
    }
}
```

## Credential Safety
```powershell
It 'Source code has no hardcoded credentials' {
    Get-ChildItem -Path ./src -Filter *.ps1 -Recurse | ForEach-Object {
        $content = Get-Content $_.FullName -Raw
        $content | Should -Not -Match 'password\s*=\s*[\x27\x22][^\x27\x22]+[\x27\x22]'
        $content | Should -Not -Match 'ConvertTo-SecureString\s+[\x27\x22][^\x27\x22]+'
    }
}
```
