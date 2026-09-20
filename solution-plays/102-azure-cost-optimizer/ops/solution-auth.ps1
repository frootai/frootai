[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Plan', 'Apply')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [string] $ApplicationName,

    [Parameter(Mandatory)]
    [ValidatePattern('^https://[a-z0-9.-]+\.azurecontainerapps\.io$')]
    [string] $ApplicationUrl,

    [Parameter(Mandatory)]
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string] $ExpiresOn
)

$ErrorActionPreference = 'Stop'
$runningOnWindows = $env:OS -eq 'Windows_NT'
$root = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $root '.solution'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$planPath = Join-Path $stateRoot 'auth-plan.json'
$resultPath = Join-Path $stateRoot 'auth.private.json'
$redirect = "$ApplicationUrl/.auth/login/aad/callback"

$plan = [ordered]@{
    tenantId = $TenantId
    displayName = $ApplicationName
    signInAudience = 'AzureADMyOrg'
    redirectUri = $redirect
    homePageUrl = $ApplicationUrl
    credentialExpiresOn = $ExpiresOn
    actions = @('create or reuse one Entra application', 'create service principal when missing', 'append one time-bounded client credential')
    secretOutput = '.solution/auth.private.json (ignored and user-only)'
}
$plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $planPath -Encoding UTF8
if ($Stage -eq 'Plan') {
    $plan | ConvertTo-Json -Depth 5
    Write-Host "Review $planPath before Apply."
    return
}

$existing = @(& az ad app list --display-name $ApplicationName --query '[].{appId:appId,id:id}' --output json --only-show-errors | ConvertFrom-Json)
if ($existing.Count -gt 1) { throw 'More than one Entra application has this display name. Use a unique solution name.' }
if ($existing.Count -eq 0) {
    $app = & az ad app create --display-name $ApplicationName --sign-in-audience AzureADMyOrg --web-home-page-url $ApplicationUrl --web-redirect-uris $redirect --enable-id-token-issuance true --output json --only-show-errors | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Entra application creation failed.' }
    & az ad sp create --id $app.appId --only-show-errors --output none
    if ($LASTEXITCODE -ne 0) { throw 'Service principal creation failed.' }
} else {
    $app = $existing[0]
    & az ad app update --id $app.id --web-home-page-url $ApplicationUrl --web-redirect-uris $redirect --enable-id-token-issuance true --only-show-errors --output none
    if ($LASTEXITCODE -ne 0) { throw 'Entra application update failed.' }
}
$credential = & az ad app credential reset --id $app.id --append --display-name 'ACO solution sign-in' --end-date $ExpiresOn --output json --only-show-errors | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $credential.password) { throw 'Credential creation failed.' }

$result = [ordered]@{
    tenantId = $TenantId
    clientId = $app.appId
    audience = "api://$($app.appId)"
    clientSecret = $credential.password
    applicationObjectId = $app.id
    expiresOn = $ExpiresOn
    redirectUri = $redirect
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resultPath -Encoding UTF8
if ($runningOnWindows) {
    $sid = (& whoami.exe /user /fo csv /nh | Select-String -Pattern 'S-1-[0-9-]+' | ForEach-Object { $_.Matches[0].Value })
    if ($sid) { & icacls.exe $resultPath /inheritance:r /grant:r "*$sid`:F" | Out-Null }
}
$credential.password = $null
Write-Host "Authentication material was written privately to $resultPath. It was not printed."
Write-Host 'Copy its values into .solution/app.parameters.json, deploy, then retain or revoke the credential according to your solution policy.'
