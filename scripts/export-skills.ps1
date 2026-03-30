#Requires -Version 7.0
<#
.SYNOPSIS
    FrootAI — Export FROOT Modules as GitHub Copilot Skills.

.DESCRIPTION
    Creates .github/skills/<module-id>/ folders that GitHub Copilot can
    consume directly as skill context.
      - SKILL.md:  Module content formatted as a Copilot skill
      - README.md: Brief description + usage instructions

.PARAMETER ModuleId
    FROOT module ID to export (e.g., F1, R2, O3, T1).

.PARAMETER All
    Export all FROOT modules at once.

.EXAMPLE
    .\scripts\export-skills.ps1 -ModuleId F1
    .\scripts\export-skills.ps1 -ModuleId R2
    .\scripts\export-skills.ps1 -All
#>

[CmdletBinding(DefaultParameterSetName = "Single")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "Single", Position = 0)]
    [string]$ModuleId,

    [Parameter(Mandatory = $true, ParameterSetName = "All")]
    [switch]$All
)

$ErrorActionPreference = "Stop"

# ─── Helpers ────────────────────────────────────────────────────────
function Write-Info  { param([string]$Msg) Write-Host "  ℹ  $Msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Msg) Write-Host "  ✅ $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "  ⚠️  $Msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$Msg) Write-Host "  ❌ $Msg" -ForegroundColor Red; throw $Msg }

# ─── FROOT Module Map ──────────────────────────────────────────────
$ModuleMap = [ordered]@{
    "F1" = @{ File = "GenAI-Foundations.md";      Title = "GenAI Foundations" }
    "F2" = @{ File = "LLM-Landscape.md";          Title = "LLM Landscape & Model Selection" }
    "F3" = @{ File = "F3-AI-Glossary-AZ.md";      Title = "AI Glossary A-Z" }
    "F4" = @{ File = "F4-GitHub-Agentic-OS.md";   Title = "GitHub Agentic OS" }
    "R1" = @{ File = "Prompt-Engineering.md";      Title = "Prompt Engineering & Grounding" }
    "R2" = @{ File = "RAG-Architecture.md";        Title = "RAG Architecture & Retrieval" }
    "R3" = @{ File = "R3-Deterministic-AI.md";     Title = "Making AI Deterministic & Reliable" }
    "O1" = @{ File = "Semantic-Kernel.md";         Title = "Semantic Kernel & Orchestration" }
    "O2" = @{ File = "AI-Agents-Deep-Dive.md";    Title = "AI Agents & Microsoft Agent Framework" }
    "O3" = @{ File = "O3-MCP-Tools-Functions.md";  Title = "MCP, Tools & Function Calling" }
    "O4" = @{ File = "Azure-AI-Foundry.md";        Title = "Azure AI Platform & Landing Zones" }
    "O5" = @{ File = "AI-Infrastructure.md";       Title = "AI Infrastructure & Hosting" }
    "O6" = @{ File = "Copilot-Ecosystem.md";       Title = "Copilot Ecosystem & Low-Code AI" }
    "T1" = @{ File = "T1-Fine-Tuning-MLOps.md";   Title = "Fine-Tuning & Model Customization" }
    "T2" = @{ File = "Responsible-AI-Safety.md";   Title = "Responsible AI & Safety" }
    "T3" = @{ File = "T3-Production-Patterns.md";  Title = "Production Architecture Patterns" }
}

# ─── Resolve Paths ──────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$DocsDir   = Join-Path $RepoRoot "docs"
$SkillsDir = Join-Path $RepoRoot ".github" "skills"

# ─── Export Function ────────────────────────────────────────────────
function Export-FrootModule {
    param([string]$Mid)

    $Mid = $Mid.ToUpper()
    $Entry = $ModuleMap[$Mid]

    if (-not $Entry) {
        Write-Warn "Unknown module ID: $Mid — skipping"
        return $false
    }

    $FileName = $Entry.File
    $Title    = $Entry.Title
    $Source   = Join-Path $DocsDir $FileName

    if (-not (Test-Path $Source)) {
        Write-Warn "Source file not found: docs\$FileName — skipping $Mid"
        return $false
    }

    # Slugify: F1 + title → F1-GenAI-Foundations
    $Slug = "$Mid-$($Title -replace '[^a-zA-Z0-9]', '-' -replace '-{2,}', '-' -replace '-$', '')"
    $SkillDir = Join-Path $SkillsDir $Slug

    New-Item -ItemType Directory -Path $SkillDir -Force | Out-Null

    # ── SKILL.md ────────────────────────────────────────────────────
    $Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $Content   = Get-Content -Path $Source -Raw

    $SkillMd = @"
# ${Mid}: ${Title}

> FrootAI FROOT Framework — Module ${Mid}
> Source: docs/${FileName}
> Generated: ${Timestamp}

---

${Content}
"@

    Set-Content -Path (Join-Path $SkillDir "SKILL.md") -Value $SkillMd -Encoding UTF8

    # ── README.md ───────────────────────────────────────────────────
    $ReadmeMd = @"
# ${Slug}

**FrootAI Skill** — ${Title}

## What is this?

This folder contains the ``${Mid}`` module from the [FrootAI FROOT Framework](https://github.com/frootai/frootai)
exported as a GitHub Copilot skill.

## How to use

Add this to your ``.github/copilot-instructions.md``:

``````markdown
<skills>
<skill>
  <name>${Slug}</name>
  <description>${Title}</description>
  <file>.github/skills/${Slug}/SKILL.md</file>
</skill>
</skills>
``````

Or reference it in your instruction files:

``````markdown
<instruction>
  <file>.github/skills/${Slug}/SKILL.md</file>
</instruction>
``````

## Source

Generated from ``docs/${FileName}`` by ``scripts\export-skills.ps1``.
"@

    Set-Content -Path (Join-Path $SkillDir "README.md") -Value $ReadmeMd -Encoding UTF8

    Write-Ok "Exported: $Slug/"
    return $true
}

# ─── Main ───────────────────────────────────────────────────────────
Write-Host "`n  🌳 FrootAI — Exporting Skills`n" -ForegroundColor White

$Exported = 0
$Failed   = 0

if ($All) {
    Write-Info "Exporting all $($ModuleMap.Count) modules..."
    foreach ($Mid in $ModuleMap.Keys) {
        if (Export-FrootModule -Mid $Mid) {
            $Exported++
        }
        else {
            $Failed++
        }
    }
}
else {
    if (Export-FrootModule -Mid $ModuleId) {
        $Exported++
    }
    else {
        $Failed++
    }
}

Write-Host ""
Write-Host "  📊 Export Summary" -ForegroundColor White
Write-Host "    Exported: $Exported" -ForegroundColor Green
Write-Host "    Failed:   $Failed" -ForegroundColor Red
Write-Host "    Output:   .github\skills\"
Write-Host ""
Write-Ok "Skills export complete! 🌳"
