# FAI Cost Tracker — PowerShell (Windows)
# Per-session cost estimation with model-aware pricing.
# VS Code Hook Event: Stop (fires when agent session ends)
# Exit: 0 always (tracking must never block workflow)

param()

$MODE = $env:COST_MODE ?? "log"
$DAILY_THRESHOLD = $env:COST_DAILY_THRESHOLD ?? "5.00"
$LOG_DIR = $env:COST_LOG_DIR ?? "logs/copilot"
$MODEL = $env:COST_MODEL ?? "gpt-4o"
$LOG_FILE = "$LOG_DIR/costs.jsonl"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null }

# Model pricing (USD per 1K tokens)
$pricing = @{
    "gpt-4o"      = 0.005
    "gpt-4o-mini" = 0.0003
    "o3"          = 0.010
    "o3-mini"     = 0.0012
    "gpt-4-turbo" = 0.010
    "gpt-4.1"     = 0.005
}
$rate = if ($pricing.ContainsKey($MODEL)) { $pricing[$MODEL] } else { 0.005 }

# Gather diff stats
try {
    $diff = git diff --numstat 2>$null
    if ($diff) {
        $lines = $diff -split "`n" | Where-Object { $_ -match '^\d' }
        $filesChanged = $lines.Count
        $linesAdded = ($lines | ForEach-Object { ($_ -split '\t')[0] } | Measure-Object -Sum).Sum
        $linesRemoved = ($lines | ForEach-Object { ($_ -split '\t')[1] } | Measure-Object -Sum).Sum
    }
    else {
        $filesChanged = 0; $linesAdded = 0; $linesRemoved = 0
    }
}
catch {
    $filesChanged = 0; $linesAdded = 0; $linesRemoved = 0
}

# Estimate tokens (~4 chars per token)
try {
    $addedChars = (git diff --unified=0 2>$null | Select-String '^\+[^+]' | ForEach-Object { $_.Line.Substring(1) } | Measure-Object -Character).Characters
    $estimatedTokens = [math]::Max(1, [math]::Floor($addedChars / 4))
}
catch {
    $estimatedTokens = 0
}

$estimatedCost = [math]::Round(($estimatedTokens / 1000) * $rate, 6)
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Log entry
$entry = @{
    timestamp          = $timestamp
    event              = "Stop"
    model              = $MODEL
    files_changed      = $filesChanged
    lines_added        = $linesAdded
    lines_removed      = $linesRemoved
    estimated_tokens   = $estimatedTokens
    estimated_cost_usd = $estimatedCost
    mode               = $MODE
} | ConvertTo-Json -Compress

Add-Content -Path $LOG_FILE -Value $entry

# Output for VS Code hook
Write-Output ($entry)
exit 0
