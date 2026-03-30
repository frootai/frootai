#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FrootAI — Export FROOT Modules as GitHub Copilot Skills
# ─────────────────────────────────────────────────────────────────────
# Creates .github/skills/<module-id>/ folders that GitHub Copilot can
# consume directly as skill context.
#
# Usage:
#   ./scripts/export-skills.sh F1              # Export one module
#   ./scripts/export-skills.sh R2              # Export one module
#   ./scripts/export-skills.sh --all           # Export all modules
#
# Output structure:
#   .github/skills/F1-GenAI-Foundations/
#   ├── SKILL.md    (module content formatted as a Copilot skill)
#   └── README.md   (brief description + usage instructions)
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Colors & Helpers ───────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}ℹ ${NC} $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️ ${NC} $*"; }
fail()  { echo -e "${RED}❌${NC} $*"; exit 1; }

# ─── FROOT Module Map ──────────────────────────────────────────────
# Maps module IDs to their doc filenames and human-readable titles
declare -A MODULE_FILE MODULE_TITLE

MODULE_FILE[F1]="GenAI-Foundations.md";          MODULE_TITLE[F1]="GenAI Foundations"
MODULE_FILE[F2]="LLM-Landscape.md";             MODULE_TITLE[F2]="LLM Landscape & Model Selection"
MODULE_FILE[F3]="F3-AI-Glossary-AZ.md";         MODULE_TITLE[F3]="AI Glossary A-Z"
MODULE_FILE[F4]="F4-GitHub-Agentic-OS.md";      MODULE_TITLE[F4]="GitHub Agentic OS"
MODULE_FILE[R1]="Prompt-Engineering.md";         MODULE_TITLE[R1]="Prompt Engineering & Grounding"
MODULE_FILE[R2]="RAG-Architecture.md";           MODULE_TITLE[R2]="RAG Architecture & Retrieval"
MODULE_FILE[R3]="R3-Deterministic-AI.md";        MODULE_TITLE[R3]="Making AI Deterministic & Reliable"
MODULE_FILE[O1]="Semantic-Kernel.md";            MODULE_TITLE[O1]="Semantic Kernel & Orchestration"
MODULE_FILE[O2]="AI-Agents-Deep-Dive.md";       MODULE_TITLE[O2]="AI Agents & Microsoft Agent Framework"
MODULE_FILE[O3]="O3-MCP-Tools-Functions.md";     MODULE_TITLE[O3]="MCP, Tools & Function Calling"
MODULE_FILE[O4]="Azure-AI-Foundry.md";           MODULE_TITLE[O4]="Azure AI Platform & Landing Zones"
MODULE_FILE[O5]="AI-Infrastructure.md";          MODULE_TITLE[O5]="AI Infrastructure & Hosting"
MODULE_FILE[O6]="Copilot-Ecosystem.md";          MODULE_TITLE[O6]="Copilot Ecosystem & Low-Code AI"
MODULE_FILE[T1]="T1-Fine-Tuning-MLOps.md";      MODULE_TITLE[T1]="Fine-Tuning & Model Customization"
MODULE_FILE[T2]="Responsible-AI-Safety.md";      MODULE_TITLE[T2]="Responsible AI & Safety"
MODULE_FILE[T3]="T3-Production-Patterns.md";     MODULE_TITLE[T3]="Production Architecture Patterns"

# ─── Parse Arguments ────────────────────────────────────────────────
EXPORT_ALL=false
MODULE_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)  EXPORT_ALL=true; shift ;;
    -h|--help)
      echo "Usage: $0 <module-id> | --all"
      echo "  module-id   FROOT module ID (e.g., F1, R2, O3, T1)"
      echo "  --all       Export all modules"
      echo ""
      echo "Available modules:"
      for mid in $(echo "${!MODULE_TITLE[@]}" | tr ' ' '\n' | sort); do
        echo "  $mid  ${MODULE_TITLE[$mid]}"
      done
      exit 0 ;;
    *)
      if [[ -z "$MODULE_ID" ]]; then
        MODULE_ID="${1^^}" # Uppercase
      else
        fail "Unknown argument: $1"
      fi
      shift ;;
  esac
done

if [[ "$EXPORT_ALL" == "false" && -z "$MODULE_ID" ]]; then
  fail "Module ID or --all required. Usage: $0 <module-id> | --all"
fi

# ─── Resolve Paths ──────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$REPO_ROOT/docs"
SKILLS_DIR="$REPO_ROOT/.github/skills"

# ─── Export Function ────────────────────────────────────────────────
export_module() {
  local mid="$1"
  local file="${MODULE_FILE[$mid]:-}"
  local title="${MODULE_TITLE[$mid]:-}"

  if [[ -z "$file" ]]; then
    warn "Unknown module ID: $mid — skipping"
    return 1
  fi

  local source="$DOCS_DIR/$file"
  if [[ ! -f "$source" ]]; then
    warn "Source file not found: docs/$file — skipping $mid"
    return 1
  fi

  # Slugify: F1 + title → F1-GenAI-Foundations
  local slug="${mid}-$(echo "$title" | sed 's/[^a-zA-Z0-9]/-/g' | sed 's/--*/-/g' | sed 's/-$//')"
  local skill_dir="$SKILLS_DIR/$slug"

  mkdir -p "$skill_dir"

  # ── SKILL.md ──────────────────────────────────────────────────────
  cat > "$skill_dir/SKILL.md" <<EOF
# ${mid}: ${title}

> FrootAI FROOT Framework — Module ${mid}
> Source: docs/${file}
> Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')

---

$(cat "$source")
EOF

  # ── README.md ─────────────────────────────────────────────────────
  cat > "$skill_dir/README.md" <<EOF
# ${slug}

**FrootAI Skill** — ${title}

## What is this?

This folder contains the \`${mid}\` module from the [FrootAI FROOT Framework](https://github.com/frootai/frootai)
exported as a GitHub Copilot skill.

## How to use

Add this to your \`.github/copilot-instructions.md\`:

\`\`\`markdown
<skills>
<skill>
  <name>${slug}</name>
  <description>${title}</description>
  <file>.github/skills/${slug}/SKILL.md</file>
</skill>
</skills>
\`\`\`

Or reference it in your instruction files:

\`\`\`markdown
<instruction>
  <file>.github/skills/${slug}/SKILL.md</file>
</instruction>
\`\`\`

## Source

Generated from \`docs/${file}\` by \`scripts/export-skills.sh\`.
EOF

  ok "Exported: $slug/"
}

# ─── Main ───────────────────────────────────────────────────────────
echo -e "\n${BOLD}🌳 FrootAI — Exporting Skills${NC}\n"

EXPORTED=0
FAILED=0

if [[ "$EXPORT_ALL" == "true" ]]; then
  info "Exporting all ${#MODULE_FILE[@]} modules..."
  for mid in $(echo "${!MODULE_FILE[@]}" | tr ' ' '\n' | sort); do
    if export_module "$mid"; then
      ((EXPORTED++))
    else
      ((FAILED++))
    fi
  done
else
  if export_module "$MODULE_ID"; then
    ((EXPORTED++))
  else
    ((FAILED++))
  fi
fi

echo ""
echo -e "${BOLD}📊 Export Summary${NC}"
echo -e "  Exported: ${GREEN}${EXPORTED}${NC}"
echo -e "  Failed:   ${RED}${FAILED}${NC}"
echo -e "  Output:   .github/skills/"
echo ""
ok "Skills export complete! 🌳"
