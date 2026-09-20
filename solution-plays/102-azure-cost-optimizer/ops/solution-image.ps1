[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z0-9]{5,50}$')]
    [string] $RegistryName,

    [ValidatePattern('^[a-z0-9._-]{1,64}$')]
    [string] $Repository = 'azure-cost-optimizer',

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')]
    [string] $Tag
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $root '.solution'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

Push-Location $root
try {
    & az acr build --subscription $SubscriptionId --registry $RegistryName --image "$Repository`:$Tag" --file Dockerfile . --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw 'ACR remote build failed.' }
}
finally { Pop-Location }

$record = & az acr repository show --subscription $SubscriptionId --name $RegistryName --image "$Repository`:$Tag" --output json --only-show-errors | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $record.digest) { throw 'The image digest could not be resolved.' }
$loginServer = (& az acr show --subscription $SubscriptionId --name $RegistryName --query loginServer --output tsv --only-show-errors).Trim()
$result = [ordered]@{
    registry = $RegistryName
    repository = $Repository
    tag = $Tag
    digest = $record.digest
    immutableImage = "$loginServer/$Repository@$($record.digest)"
    builtAt = $record.lastUpdateTime
}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stateRoot 'image.json') -Encoding UTF8
$result | ConvertTo-Json -Depth 4
