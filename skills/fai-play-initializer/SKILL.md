---
name: fai-play-initializer
description: 'Scaffolds a complete FAI solution play with DevKit, TuneKit, SpecKit, infrastructure templates, and fai-manifest.json — the full FAI Protocol structure ready for development.'
---

# FAI Play Initializer

Scaffold a complete FAI solution play following the Play 101 golden template. Every play is a self-contained Copilot workspace with agent orchestration, tunable config, infrastructure-as-code, evaluation pipeline, and FAI Protocol wiring.

## Play Folder Structure

The canonical layout — every directory has a purpose, nothing optional:

```
solution-plays/NN-play-name/
├── agent.md                        # Root orchestrator — Copilot loads this first
├── .github/
│   ├── copilot-instructions.md     # Knowledge-only, <150 lines, <1500 tokens
│   ├── agents/
│   │   ├── builder.agent.md        # Implements the solution
│   │   ├── reviewer.agent.md       # Security + quality review
│   │   └── tuner.agent.md          # Config validation + eval thresholds
│   ├── instructions/
│   │   └── {domain}.instructions.md
│   ├── prompts/
│   │   ├── test.prompt.md
│   │   └── evaluate.prompt.md
│   ├── skills/{action}-{domain}/SKILL.md
│   ├── hooks/
│   │   └── guardrails.json         # SessionStart only — never PreToolUse
│   └── workflows/build.yml
├── .vscode/
│   ├── mcp.json                    # MCP server wiring
│   └── settings.json               # Copilot model + tool config
├── config/                         # TuneKit — customer-tunable AI params
│   ├── openai.json
│   └── guardrails.json
├── infra/                          # Azure Bicep (AVM modules preferred)
│   ├── main.bicep
│   └── main.bicepparam
├── evaluation/                     # AI quality pipeline
│   ├── evaluate.py
│   └── test-cases.jsonl
├── spec/                           # SpecKit — metadata + docs
│   └── waf-alignment.json
├── fai-manifest.json               # FAI Protocol glue — REQUIRED
└── README.md
```

## Scaffolding Script

Run from repo root. Creates all files with real content, not placeholders:

```bash
#!/usr/bin/env bash
set -euo pipefail

NN="${1:?Usage: init-play.sh NN play-name}"
NAME="${2:?Usage: init-play.sh NN play-name}"
DIR="solution-plays/${NN}-${NAME}"

mkdir -p "$DIR"/{.github/{agents,instructions,prompts,skills,hooks,workflows},.vscode,config,infra,evaluation,spec}

# agent.md — root orchestrator (Copilot loads this first)
cat > "$DIR/agent.md" <<'EOF'
---
description: "Root orchestrator for this solution play"
tools: ["codebase", "terminal", "github"]
model: ["gpt-4o", "gpt-4o-mini"]
---
Route tasks: @builder for implementation, @reviewer for security + quality, @tuner for config validation.
EOF

# copilot-instructions.md — knowledge ONLY, <150 lines, no behavioral overrides
cat > "$DIR/.github/copilot-instructions.md" <<'EOF'
# Play ${NN} — ${NAME}
## Architecture
- Component A → Component B → Component C
## Key Decisions
- Model: gpt-4o (temperature 0.1), Embedding: text-embedding-3-large (3072d)
## Domain Rules
- All responses include citation sources, token budget: 4000/request
EOF

# Agent triad: builder (gpt-4o), reviewer + tuner (gpt-4o-mini)
for role in builder reviewer tuner; do
  cat > "$DIR/.github/agents/${role}.agent.md" <<EOF
---
description: "${role^} agent for play ${NN}"
tools: ["codebase"$([ "$role" = "builder" ] && echo ', "terminal", "github"')]
model: ["$([ "$role" = "builder" ] && echo 'gpt-4o' || echo 'gpt-4o-mini')"]
---
EOF
done

# Hooks — SessionStart ONLY (PreToolUse = 5s delay per tool call, never use it)
cat > "$DIR/.github/hooks/guardrails.json" <<'EOF'
{"version":1,"hooks":[{"event":"SessionStart","command":"echo FAI guardrails active"}]}
EOF

# MCP + VS Code settings
cat > "$DIR/.vscode/mcp.json" <<'EOF'
{"servers":{"frootai":{"command":"npx","args":["frootai-mcp@latest"],"env":{}}}}
EOF
cat > "$DIR/.vscode/settings.json" <<'EOF'
{"chat.agent.model":"gpt-4o","github.copilot.chat.codeGeneration.instructions":[{"file":".github/copilot-instructions.md"}]}
EOF
```

## Config Files (TuneKit)

The only files customers edit. Everything else is DevKit (agent-managed).

```json
// config/openai.json — model parameters
{"model":"gpt-4o","api_version":"2024-12-01-preview","temperature":0.1,
 "max_tokens":4000,"seed":42,"response_format":{"type":"json_object"},
 "fallback":{"model":"gpt-4o-mini","max_tokens":2000}}
```

```json
// config/guardrails.json — quality thresholds + actions
{"groundedness":{"threshold":0.95,"action":"retry","max_retries":2},
 "coherence":{"threshold":0.90,"action":"retry"},
 "relevance":{"threshold":0.85,"action":"warn"},
 "safety":{"max_violations":0,"action":"block"},
 "cost":{"max_per_query_usd":0.02,"monthly_budget_usd":500}}
```

## fai-manifest.json

The FAI Protocol glue — what makes a folder a play:

```json
{
  "play": "NN-play-name",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "O4-Azure-AI-Services"],
    "waf": ["security", "reliability", "cost-optimization"],
    "compatible_plays": []
  },
  "primitives": {
    "agents": [".github/agents/builder.agent.md", ".github/agents/reviewer.agent.md"],
    "instructions": [".github/instructions/*.instructions.md"],
    "skills": [".github/skills/*/SKILL.md"],
    "hooks": [".github/hooks/guardrails.json"]
  },
  "toolkit": {
    "tunekit": "config/",
    "speckit": "spec/",
    "infra": "infra/"
  },
  "guardrails": {
    "groundedness": 0.95,
    "coherence": 0.90,
    "safety": 0
  }
}
```

## README Template

README must include: one-line description, architecture diagram (Mermaid), quick start (3 steps: open in VS Code → Copilot loads agent.md → ask to initialize), WAF alignment table (Security/Reliability/Cost rows minimum), config section pointing to `config/openai.json` + `config/guardrails.json`, and evaluation command `python evaluation/evaluate.py`.

## Validation Checklist

Run after scaffolding — every item must pass before the play ships:

1. **Structure**: 12+ directories exist (`.github/agents`, `.vscode`, `config`, `infra`, `evaluation`, `spec`)
2. **agent.md**: YAML frontmatter with `description`, `tools`, `model`
3. **copilot-instructions.md**: <150 lines, knowledge only, no behavioral overrides
4. **Agent triad**: `builder.agent.md`, `reviewer.agent.md`, `tuner.agent.md` with frontmatter
5. **Config**: `openai.json` + `guardrails.json` parse as valid JSON
6. **fai-manifest.json**: Has `play`, `version`, `context.waf[]`, `primitives`, `guardrails`
7. **Hooks**: Only `SessionStart` events — zero `PreToolUse`
8. **MCP**: `.vscode/mcp.json` uses `npx`, no hardcoded secrets
9. **Secrets**: `grep -rE "sk-|api[_-]key|password" $DIR` returns empty
10. **CI**: `node scripts/validate-primitives.js` passes with 0 errors

## Anti-Patterns

- **No PreToolUse hooks** — spawns a process per tool call, 5s delay each
- **No behavioral instructions in copilot-instructions.md** — knowledge only, the model handles behavior
- **No hardcoded API keys in mcp.json** — use `inputs` for secrets or `envFile` for `.env`
- **No placeholder files** — every file must have real, functional content
- **No vendor lock-in in config/** — TuneKit files must be model-agnostic where possible
