[CmdletBinding()]
param(
    [string] $Version = '2.0.0'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $PSScriptRoot 'validate-solution.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Solution validation failed; no public package was created.' }

$packageRoot = Join-Path $root 'solution-package'
$staging = Join-Path $root '.solution\package-staging'
Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null

$excludeDirectories = @('.git', '.artifacts', '.solution', '.azure', '.foundry', '.checkpoints', 'bin', 'obj', 'node_modules', 'TestResults', 'playwright-report', 'test-results', 'coverage', 'solution-package', (Join-Path $root 'templates\product'))
$excludeFiles = @('.env', '.env.*', '.agent.log', '*.log', '*.user', '*.suo', '*.pdb', '*.dll', '*.exe', 'product-bundle.v2.json', 'product-bundle-receipt.v2.json')
$arguments = @($root, $staging, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/XD') + $excludeDirectories + @('/XF') + $excludeFiles
& robocopy @arguments | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Staging copy failed with exit code $LASTEXITCODE." }

$archive = Join-Path $packageRoot "azure-cost-optimizer-solution-$Version.zip"
Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
$files = @(Get-ChildItem -LiteralPath $staging -Recurse -File)
$receipt = [ordered]@{
    schemaVersion = '1.0.0'
    package = [IO.Path]::GetFileName($archive)
    version = $Version
    sha256 = $hash
    bytes = (Get-Item $archive).Length
    files = $files.Count
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
    validationReceipt = '.solution/validation.json'
    source = 'sanitized public solution tree'
    productionCertified = $false
}
$receiptJson = $receipt | ConvertTo-Json -Depth 5
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $packageRoot 'product-bundle-receipt.json'), "$receiptJson`n", $utf8NoBom)
Remove-Item -LiteralPath $staging -Recurse -Force
$receiptJson
