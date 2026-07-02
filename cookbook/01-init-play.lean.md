# Recipe 1: Initialize a Solution Play

> Scaffold a new FrootAI solution play with the full FAI Protocol structure — fai-manifest.json, DevKit, TuneKit, SpecKit, and Bicep infrastructure.

## What You'll Build

A deployable solution play with all seven primitive types wired through the FAI Protocol: `fai-manifest.json`, `.github/` DevKit, eval configs, and a validated play loadable by the FAI Engine.

## What Is a Solution Play?

A solution play is a **complete, deployable AI solution**: one unit of work in FrootAI. It bundles DevKit, TuneKit, SpecKit, infra, and a manifest.

| Toolkit | Folder | Contents |
|---------|--------|----------|
| **DevKit** | `.github/` | Agents, instructions, prompts, skills, hooks — 7 primitives |
| **TuneKit** | `config/` | Model params, eval thresholds, guardrails |
| **SpecKit** | `spec/` | ADRs, diagrams, implementation notes |
| **Infrastructure** | `infra/` | Bicep/Terraform for Azure resources |
| **FAI Manifest** | `fai-manifest.json` | Protocol wiring for all of the above |

**DevKit** gives the coding agent context. **TuneKit** sets quality gates. **SpecKit** records design decisions. The manifest binds them.

## Prerequisites

- Node.js 22+
- FrootAI repo cloned (`git clone https://github.com/frootai/frootai`)
- Familiarity with the play’s target architecture (RAG, agents, batch, etc.)
- Azure CLI installed if deploying infrastructure

## Steps

### 1. Pick a play number and kebab-case name

Play numbers 01–68 are assigned; check existing plays first:

```bash
ls solution-plays/ | sort
```

Choose the next available number. Names must be lowercase-hyphen:

```bash
PLAY_NUM="69"
PLAY_NAME="semantic-code-review"
PLAY_DIR="solution-plays/${PLAY_NUM}-${PLAY_NAME}"
```

### 2. Scaffold the full directory tree

```bash
mkdir -p ${PLAY_DIR}/{.github/{agents,instructions,prompts,skills,hooks},config,spec,infra,src,tests}
```

The resulting structure:

```
solution-plays/69-semantic-code-review/
├── .github/
│   ├── agents/           # Play-specific agent personalities
│   ├── instructions/     # Auto-applied coding standards
│   ├── prompts/          # Reusable prompt templates
│   ├── skills/           # Step-by-step procedures
│   └── hooks/            # Event-triggered guardrails
├── config/
│   ├── openai.json       # Model + temperature + token budgets
│   └── guardrails.json   # Safety thresholds
├── spec/
│   └── 001-architecture.md
├── infra/
│   └── main.bicep        # Azure resources
├── src/                  # Application code
├── tests/                # Evaluation + integration tests
├── fai-manifest.json     # FAI Protocol wiring
├── froot.json            # Play metadata
└── README.md             # Quick-start + architecture
```

### 3. Create fai-manifest.json

Wires primitives, knowledge, WAF pillars, and guardrails:

```json
{
  "$schema": "https://frootai.dev/schemas/fai-manifest.schema.json",
  "play": "69-semantic-code-review",
  "version": "1.0.0",
  "context": {
    "knowledge": [
      "R1-Prompt-Patterns",
      "O2-Agent-Coding",
      "T2-Responsible-AI"
    ],
    "waf": [
      "security",
      "reliability",
      "cost-optimization",
      "operational-excellence"
    ],
    "scope": "Automated code review using semantic analysis and LLM-based reasoning"
  },
  "primitives": {
    "agents": [
      "./.github/agents/code-review-agent.agent.md"
    ],
    "instructions": [
      "./.github/instructions/review-standards.instructions.md"
    ],
    "skills": [
      "./.github/skills/run-semantic-review/"
    ],
    "hooks": [
      "../../hooks/frootai-secrets-scanner/",
      "../../hooks/frootai-tool-guardian/",
      "../../hooks/frootai-governance-audit/"
    ],
    "guardrails": {
      "groundedness": 0.90,
      "coherence": 0.85,
      "safety": 0.99,
      "costPerQuery": 0.02
    }
  },
  "infrastructure": {
    "bicep": "./infra/main.bicep",
    "parameters": "./infra/main.bicepparam"
  },
  "toolkit": {
    "devkit": "./.github/",
    "tunekit": "./config/",
    "speckit": "./spec/"
  }
}
```

**Key rules:**
- `play` must match the folder name exactly (`69-semantic-code-review`)
- `version` must be valid semver
- `knowledge` references FROOT module IDs (F1–F4, R1–R3, O1–O6, T1–T3)
- `guardrails` thresholds are 0–1 floats; `costPerQuery` is USD

### 4. Create froot.json (play metadata)

```json
{
  "name": "69-semantic-code-review",
  "version": "1.0.0",
  "framework": "frootai",
  "title": "Semantic Code Review",
  "description": "AI-driven code review that understands architecture patterns, detects anti-patterns, and suggests WAF-aligned improvements.",
  "complexity": "Medium",
  "tags": ["code-review", "agents", "developer-tools"],
  "status": "Active",
  "azure_services": [
    "Azure OpenAI",
    "Azure Container Apps"
  ]
}
```

### 5. Create TuneKit config files

**config/openai.json** — model parameters:

```json
{
  "model": "gpt-4o",
  "temperature": 0.3,
  "max_tokens": 4096,
  "top_p": 0.95,
  "frequency_penalty": 0,
  "presence_penalty": 0,
  "fallback_model": "gpt-4o-mini"
}
```

**config/guardrails.json** — evaluation thresholds:

```json
{
  "thresholds": {
    "groundedness": 0.90,
    "coherence": 0.85,
    "relevance": 0.80,
    "fluency": 0.85,
    "safety": 0.99
  },
  "content_safety": {
    "hate": 0,
    "violence": 0,
    "self_harm": 0,
    "sexual": 0
  },
  "cost": {
    "max_tokens_per_request": 4096,
    "max_cost_per_query_usd": 0.02
  }
}
```

### 6. Create a DevKit agent

```bash
cat > ${PLAY_DIR}/.github/agents/code-review-agent.agent.md << 'EOF'
---
description: "Reviews code for security, reliability, and cost patterns with WAF alignment."
model: gpt-4o
tools:
  - github
  - bash
waf:
  - security
  - reliability
plays:
  - 69-semantic-code-review
---

You are the Semantic Code Review agent for Play 69. Analyze pull requests and code
changes against the six WAF pillars. Flag security issues (hardcoded secrets, SQL
injection), reliability gaps (missing retries, no health checks), and cost concerns
(unbounded token usage, oversized SKUs).

Always cite the specific WAF pillar and provide a fix suggestion with code.
EOF
```

### 7. Create the play README

```markdown
# Play 69: Semantic Code Review

> AI-powered code review that enforces WAF patterns across pull requests.

## Architecture

PR Webhook → Azure Container Apps → GPT-4o Analysis → GitHub PR Comment

## Azure Services

| Service | Purpose | SKU |
|---------|---------|-----|
| Azure OpenAI | Code analysis | Standard (GPT-4o) |
| Azure Container Apps | Hosting | Consumption |
| Azure Key Vault | Secrets | Standard |

## Quick Start

\`\`\`bash
az deployment group create -g rg-frootai -f infra/main.bicep
node engine/index.js solution-plays/69-semantic-code-review/fai-manifest.json --status
\`\`\`

## WAF Alignment

| Pillar | Implementation |
|--------|---------------|
| Security | Managed Identity, Key Vault, input sanitization |
| Reliability | Retry with backoff, circuit breaker |
| Cost | GPT-4o-mini triage, GPT-4o deep review, token budgets |
| Ops Excellence | Structured logging, App Insights, IaC |
```

### 8. Validate everything

```bash
# Validate all primitives (schema + naming + frontmatter)
npm run validate:primitives

# Load the play in the FAI Engine
node engine/index.js ${PLAY_DIR}/fai-manifest.json --status

# Verify JSON files parse correctly
node -e "require('./${PLAY_DIR}/fai-manifest.json'); console.log('✅ manifest OK')"
node -e "require('./${PLAY_DIR}/froot.json'); console.log('✅ froot.json OK')"
node -e "require('./${PLAY_DIR}/config/openai.json'); console.log('✅ openai.json OK')"
node -e "require('./${PLAY_DIR}/config/guardrails.json'); console.log('✅ guardrails.json OK')"
```

Expected FAI Engine output:

```
🍊 FAI Engine v0.1
══════════════════════════════════════════════════
  Play:      69-semantic-code-review v1.0.0
  Knowledge: 3 FROOT modules
  WAF:       4 pillars enforced
  Hooks:     3 security hooks wired
  Guardrails: groundedness≥0.90, safety≥0.99
  ✅ All primitives wired, context resolved
══════════════════════════════════════════════════
```

### 9. Create a matching plugin

Package your play as an installable plugin for the marketplace:

```bash
mkdir -p plugins/semantic-code-review
cat > plugins/semantic-code-review/plugin.json << 'EOF'
{
  "name": "semantic-code-review",
  "description": "AI-driven code review with WAF-aligned pattern detection",
  "version": "1.0.0",
  "author": { "name": "FrootAI" },
  "repository": "https://github.com/frootai/frootai",
  "license": "MIT",
  "keywords": ["code-review", "agents", "waf"],
  "agents": ["./.github/agents/code-review-agent.agent.md"],
  "instructions": [],
  "skills": [],
  "hooks": [
    "../../hooks/frootai-secrets-scanner/",
    "../../hooks/frootai-tool-guardian/"
  ],
  "plays": ["69-semantic-code-review"]
}
EOF

npm run generate:marketplace
```

### 10. Regenerate website data

```bash
npm run generate:website-data
npm run update:readme
```

## Or Use the Skill

Invoke the `frootai-play-initializer` skill in Copilot Chat for interactive scaffolding:

```
@workspace /skill frootai-play-initializer
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `validate:primitives` fails on manifest | Missing required field | Check `play`, `version`, `context.knowledge[]` all exist |
| Engine says "primitives not found" | Relative path wrong | Paths in manifest are relative to the manifest file location |
| Plugin not in marketplace | Not regenerated | Run `npm run generate:marketplace` after creating plugin.json |
| Guardrail threshold error | Value outside 0–1 | `safety: 0` means "no threshold", not zero tolerance |
| `froot.json` parse error | Trailing comma in JSON | Remove trailing commas; validate with `node -e "require('./froot.json')"` |
| Engine shows 0 hooks | Hook paths don't resolve | Use `../../hooks/` prefix — hooks live at repo root, not inside plays |

## Best Practices

1. **Manifest first** — create `fai-manifest.json` before any other file; it's the play's DNA
2. **Wire 3 security hooks minimum** — secrets-scanner, tool-guardian, governance-audit
3. **Set realistic guardrails** — groundedness ≥ 0.85, safety ≥ 0.95 for production
4. **Create a plugin** — makes your play installable via the marketplace
5. **Validate after every change** — `npm run validate:primitives` should always pass
6. **Include a SpecKit ADR** — document the "why" behind architecture choices in `spec/`
7. **Use GPT-4o-mini for fallback** — set `fallback_model` in openai.json for cost control
8. **Tag your play** — `froot.json` tags drive marketplace search and website filtering
