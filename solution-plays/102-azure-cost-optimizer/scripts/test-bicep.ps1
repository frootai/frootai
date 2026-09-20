[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$files = Get-ChildItem -LiteralPath (Join-Path $root 'infra') -File -Filter '*.bicep' | Sort-Object Name
foreach ($file in $files) {
    & az bicep build --file $file.FullName --stdout --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Bicep compilation failed: $($file.Name)" }
    Write-Host "PASS $($file.Name)"
}
