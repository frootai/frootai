---
description: "Azure PowerShell testing patterns — mocking Az cmdlets, testing Azure Policy lifecycle, DiagnosticLogs validation, remediation testing"
applyTo: "solution-plays/101-pester-test-development/**/*.{ps1,Tests.ps1}"
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
        PolicyAssignmentId = '/providers/Microsoft.Authorization/policyAssignments/test-assignment'
        Properties = @{
            PolicyDefinitionId = '/providers/Microsoft.Authorization/policyDefinitions/nsg-diagnostics'
            Scope = '/providers/Microsoft.Management/managementGroups/BASF_ManagementRoot'
        }
    }
}
```

### Policy Compliance Testing
```powershell
Mock Get-AzPolicyState -ParameterFilter { $PolicyDefinitionName -eq 'nsg-diagnostics' } {
    [PSCustomObject]@{
        ComplianceState = 'Compliant'
        ResourceId = '/subscriptions/test/resourceGroups/rg1/providers/Microsoft.Network/networkSecurityGroups/nsg1'
        PolicyDefinitionName = 'nsg-diagnostics'
        Timestamp = Get-Date
    }
}
```

### Remediation Testing
```powershell
Mock Start-AzPolicyRemediation {
    [PSCustomObject]@{
        Name = 'remediation-001'
        ProvisioningState = 'Accepted'
        PolicyAssignmentId = '/providers/Microsoft.Authorization/policyAssignments/test-assignment'
    }
}

Mock Get-AzPolicyRemediation {
    [PSCustomObject]@{
        Name = 'remediation-001'
        ProvisioningState = 'Succeeded'
        DeploymentSummary = @{
            TotalDeployments = 5
            SuccessfulDeployments = 5
            FailedDeployments = 0
        }
    }
}
```

### DiagnosticLogs NSG Policy Testing
```powershell
Describe 'NSG DiagnosticLogs Policy' -Tag 'Integration' {
    BeforeAll {
        Mock Get-AzNetworkSecurityGroup {
            [PSCustomObject]@{
                Id = '/subscriptions/test/resourceGroups/rg1/providers/Microsoft.Network/networkSecurityGroups/nsg1'
                Name = 'nsg1'
                Location = 'eastus'
            }
        }
        Mock Set-AzDiagnosticSetting { [PSCustomObject]@{ Name = 'service' } }
        Mock Get-AzDiagnosticSetting { $null }  # No existing settings
    }

    It 'Configures diagnostic settings on new NSG' {
        Set-NsgDiagnosticPolicy -NsgName 'nsg1' -WorkspaceId '/subscriptions/ee5f8667/.../workspaces/monitoring-chub01'
        Should -Invoke Set-AzDiagnosticSetting -Times 1 -Exactly
    }

    It 'Sets correct diagnostic categories' {
        Set-NsgDiagnosticPolicy -NsgName 'nsg1' -WorkspaceId '/subscriptions/ee5f8667/.../workspaces/monitoring-chub01'
        Should -Invoke Set-AzDiagnosticSetting -ParameterFilter {
            $Category -contains 'NetworkSecurityGroupEvent' -and
            $Category -contains 'NetworkSecurityGroupRuleCounter'
        }
    }

    It 'Sends logs to correct Log Analytics workspace' {
        Set-NsgDiagnosticPolicy -NsgName 'nsg1' -WorkspaceId '/subscriptions/ee5f8667/.../workspaces/monitoring-chub01'
        Should -Invoke Set-AzDiagnosticSetting -ParameterFilter {
            $WorkspaceId -like '*/workspaces/monitoring-chub01*'
        }
    }

    Context 'When remediation is needed' {
        BeforeAll {
            Mock Get-AzDiagnosticSetting { [PSCustomObject]@{ Name = 'wrong-setting' } }  # Wrong config
            Mock Start-AzPolicyRemediation { [PSCustomObject]@{ ProvisioningState = 'Accepted' } }
        }

        It 'Triggers remediation for incorrect diagnostic settings' {
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
    if ($policyFiles) {
        $testCases = $policyFiles | ForEach-Object { @{ Name = $_.BaseName; Path = $_.FullName } }
    }
}

Describe 'Policy Definition JSON Validation' -Tag 'Unit' {
    It '<Name> is valid JSON' -ForEach $testCases {
        { Get-Content $Path -Raw | ConvertFrom-Json } | Should -Not -Throw
    }

    It '<Name> has required properties' -ForEach $testCases {
        $policy = Get-Content $Path -Raw | ConvertFrom-Json
        $policy.properties.policyType | Should -Be 'Custom'
        $policy.properties.displayName | Should -Not -BeNullOrEmpty
        $policy.properties.policyRule | Should -Not -BeNullOrEmpty
    }

    It '<Name> has valid effect type' -ForEach $testCases {
        $policy = Get-Content $Path -Raw | ConvertFrom-Json
        $effect = $policy.properties.policyRule.then.effect
        $effect | Should -BeIn @('Audit', 'Deny', 'DeployIfNotExists', 'Modify', 'AuditIfNotExists', 'Disabled')
    }
}
```
