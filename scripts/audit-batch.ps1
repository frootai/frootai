param([int]$From = 1, [int]$To = 10)

$base = "c:\CodeSpace\frootai\solution-plays"

foreach ($n in $From..$To) {
    $pad = "{0:D2}" -f $n
    $dir = Get-ChildItem $base -Directory | Where-Object { $_.Name -match "^$pad-" } | Select-Object -First 1
    if (-not $dir) { Write-Output "PLAY $pad NOT FOUND"; continue }
    $b = $dir.FullName
    $name = $dir.Name

    # Check 1: agent.md handoffs
    $a = Get-Content "$b\agent.md" -Raw -ErrorAction SilentlyContinue
    $c1 = if ($a -match 'handoffs:') { "P" } else { "F" }

    # Check 2: agent.md model fallback array
    $c2 = if ($a -match 'model:\s*\[') { "P" } else { "F" }

    # Check 3-5: builder/reviewer/tuner model + WAF
    $bu = Get-Content "$b\.github\agents\builder.agent.md" -Raw -ErrorAction SilentlyContinue
    $c3 = if ($bu -match 'model:' -and $bu -match 'waf:') { "P" } else { "F" }

    $rv = Get-Content "$b\.github\agents\reviewer.agent.md" -Raw -ErrorAction SilentlyContinue
    $c4 = if ($rv -match 'model:' -and $rv -match 'waf:') { "P" } else { "F" }

    $tn = Get-Content "$b\.github\agents\tuner.agent.md" -Raw -ErrorAction SilentlyContinue
    $c5 = if ($tn -match 'model:' -and $tn -match 'waf:') { "P" } else { "F" }

    # Check 6-9: Prompts with agent field
    $promptChecks = @()
    foreach ($p in "test", "review", "deploy", "evaluate") {
        $pc = Get-Content "$b\.github\prompts\$p.prompt.md" -Raw -ErrorAction SilentlyContinue
        $promptChecks += if ($pc -match 'agent:') { "P" } else { "F" }
    }

    # Check 10: mcp.json inputs + envFile
    $mc = Get-Content "$b\.vscode\mcp.json" -Raw -ErrorAction SilentlyContinue
    $c10 = if ($mc -match 'inputs' -and $mc -match 'envFile') { "P" } else { "F" }

    # Check 11: Skills >= 100 lines each, at least 3
    $skillFiles = Get-ChildItem "$b\.github\skills" -Recurse -Filter "SKILL.md" -ErrorAction SilentlyContinue
    $skillInfo = @()
    $underCount = 0
    foreach ($sf in $skillFiles) {
        $lc = (Get-Content $sf.FullName).Count
        $skillInfo += "$($sf.Directory.Name)=$lc"
        if ($lc -lt 100) { $underCount++ }
    }
    $c11 = if ($skillFiles.Count -ge 3 -and $underCount -eq 0) { "P" } else { "F" }
    $skillDetail = $skillInfo -join ", "

    # Check 12: README.md exists
    $c12 = if (Test-Path "$b\README.md") { "P" } else { "F" }

    $all = @($c1, $c2, $c3, $c4, $c5, $promptChecks[0], $promptChecks[1], $promptChecks[2], $promptChecks[3], $c10, $c11, $c12)
    $passCount = ($all | Where-Object { $_ -eq "P" }).Count
    
    Write-Output "| $name | $passCount/12 | $c1 | $c2 | $c3 | $c4 | $c5 | $($promptChecks[0]) | $($promptChecks[1]) | $($promptChecks[2]) | $($promptChecks[3]) | $c10 | $c11 | $c12 | $skillDetail |"
}
