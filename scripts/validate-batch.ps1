param([int]$From = 71, [int]$To = 80)

$base = "c:\CodeSpace\frootai\solution-plays"
$jsonErrors = @(); $yamlErrors = @(); $ciOver = @(); $hookViolations = @()

foreach ($n in $From..$To) {
    $pad = "{0:D2}" -f $n
    $dir = Get-ChildItem $base -Directory | Where-Object { $_.Name -match "^$pad-" } | Select-Object -First 1
    if (-not $dir) { continue }
    $b = $dir.FullName

    # JSON validation
    $jsons = Get-ChildItem $b -Recurse -Filter "*.json" -ErrorAction SilentlyContinue
    foreach ($j in $jsons) {
        try { $null = Get-Content $j.FullName -Raw | ConvertFrom-Json -ErrorAction Stop }
        catch { $jsonErrors += "$($dir.Name)/$($j.Name)" }
    }

    # YAML frontmatter
    $mds = Get-ChildItem "$b\.github" -Recurse -Filter "*.md" -ErrorAction SilentlyContinue
    foreach ($md in $mds) {
        $c = Get-Content $md.FullName -Raw
        if ($c -match '^---') {
            if (-not ($c -match '^---[\s\S]*?---')) { $yamlErrors += "$($dir.Name)/$($md.Name)" }
        }
    }

    # CI < 150 lines
    $ci = "$b\.github\copilot-instructions.md"
    if (Test-Path $ci) {
        $lc = (Get-Content $ci).Count
        if ($lc -gt 150) { $ciOver += "$($dir.Name): $lc lines" }
    }

    # No PreToolUse
    $hooks = Get-ChildItem "$b\.github" -Recurse -Filter "hooks.json" -ErrorAction SilentlyContinue
    foreach ($h in $hooks) {
        if ((Get-Content $h.FullName -Raw) -match 'PreToolUse') { $hookViolations += $dir.Name }
    }
}

Write-Output "=== VALIDATION RESULTS ==="
Write-Output "JSON: $(if ($jsonErrors.Count -eq 0) { 'ALL VALID' } else { "$($jsonErrors.Count) ERRORS" })"
$jsonErrors | ForEach-Object { Write-Output "  ERROR: $_" }
Write-Output "YAML: $(if ($yamlErrors.Count -eq 0) { 'ALL VALID' } else { "$($yamlErrors.Count) ERRORS" })"
$yamlErrors | ForEach-Object { Write-Output "  ERROR: $_" }
Write-Output "CI <150L: $(if ($ciOver.Count -eq 0) { 'ALL PASS' } else { "$($ciOver.Count) OVER" })"
$ciOver | ForEach-Object { Write-Output "  OVER: $_" }
Write-Output "HOOKS: $(if ($hookViolations.Count -eq 0) { 'NO PreToolUse' } else { "$($hookViolations.Count) VIOLATIONS" })"
$hookViolations | ForEach-Object { Write-Output "  VIOLATION: $_" }
