[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Plan', 'Apply')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._()-]{1,90}$')]
    [string] $ResourceGroupName,

    [string] $ConfirmResourceGroupName
)

$ErrorActionPreference = 'Stop'
$group = & az group show --subscription $SubscriptionId --name $ResourceGroupName --output json --only-show-errors | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'The resource group was not found or is not accessible.' }
if ($group.tags.application -ne 'azure-cost-optimizer' -or $group.tags.purpose -ne 'user-solution') {
    throw 'Cleanup refuses this resource group because its ownership tags do not identify an Azure Cost Optimizer public solution.'
}
$resources = @(& az resource list --subscription $SubscriptionId --resource-group $ResourceGroupName --query '[].{name:name,type:type}' --output json --only-show-errors | ConvertFrom-Json)
$plan = [ordered]@{
    resourceGroup = $ResourceGroupName
    resourceCount = $resources.Count
    resources = $resources
    sharedResourcesExcluded = $true
    action = 'Delete the solution-owned resource group and every resource inside it.'
}
$plan | ConvertTo-Json -Depth 6
if ($Stage -eq 'Plan') { return }
if ($ConfirmResourceGroupName -cne $ResourceGroupName) { throw 'Apply requires -ConfirmResourceGroupName with the exact case-sensitive resource-group name.' }
& az group delete --subscription $SubscriptionId --name $ResourceGroupName --yes --no-wait --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Cleanup submission failed.' }
Write-Host 'Cleanup submitted. Shared resources outside this solution-owned resource group were not touched.'
