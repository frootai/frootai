---
name: fai-manifest-create
description: "Create or update fai-manifest.json with solution play context, primitive wiring, and guardrails thresholds."
waf: ["Operational Excellence", "Security", "Responsible AI"]
plays: []
---

# FAI Manifest Creation

The `fai-manifest.json` is the FAI Protocol's wiring file — it binds agents, instructions, skills, hooks, and guardrails into a single deployable solution play. Without it, primitives are standalone; with it, they auto-wire through shared context.

## Schema Structure

Every manifest has 6 top-level fields. `play`, `version`, `context`, and `primitives` are required:

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["R2-RAG-Architecture", "O3-MCP-Tools-Functions"],
    "waf": ["security", "reliability", "cost-optimization"],
    "scope": "enterprise-rag-qa"
  },
  "primitives": {
    "agents": ["./agent.md"],
    "instructions": ["./instructions.md", "../../instructions/python-waf.instructions.md"],
    "skills": ["./.github/skills/deploy-enterprise-rag/"],
    "hooks": ["../../hooks/fai-secrets-scanner/"],
    "workflows": [],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "relevance": 0.85,
      "safety": 0,
      "costPerQuery": 0.01
    }
  },
  "infrastructure": {
    "bicep": "./infra/main.bicep",
    "parameters": "./infra/parameters.json"
  },
  "toolkit": {
    "devkit": "./.github/",
    "tunekit": "./config/",
    "speckit": "./spec/"
  }
}
```

## Field Validation Rules

| Field | Format | Constraint |
|-------|--------|------------|
| `play` | `NN-kebab-case` | Must match `^[0-9]{2}-[a-z0-9-]+$` |
| `version` | semver | `^[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$` |
| `context.knowledge` | string array | Min 1 item, must reference valid FROOT module IDs (F1-F4, R1-R3, O1-O6, T1-T3) |
| `context.waf` | enum array | Values: `security`, `reliability`, `cost-optimization`, `operational-excellence`, `performance-efficiency`, `responsible-ai`. Min 1, unique |
| `context.scope` | string | Free-form scenario identifier |
| `primitives.agents` | path array | Relative paths to `.agent.md` files from play root |
| `primitives.instructions` | path array | Relative paths to `.instructions.md` files. `../../` for shared repo-level ones |
| `primitives.skills` | path array | Paths to skill *folders* (not SKILL.md files) |
| `primitives.hooks` | path array | Paths to hook folders containing `hooks.json` |
| `guardrails.*` | number 0-1 | All thresholds are 0-1 range. `safety` must be integer 0 |
| `guardrails.costPerQuery` | number ≥0 | Max USD per query. Enforced by WAF Cost pillar |

## Step-by-Step Creation

### 1. Determine play identity

The play ID is the folder name under `solution-plays/`. Version starts at `1.0.0`:

```bash
PLAY_ID="42-custom-solution"
mkdir -p "solution-plays/${PLAY_ID}/spec"
```

### 2. Identify knowledge dependencies

Map your play's domain to FROOT modules. Common mappings:
- RAG plays → `R2-RAG-Architecture`, `F1-GenAI-Foundations`
- Agent plays → `O2-Agents`, `R1-Prompts`
- Infrastructure plays → `O5-Infra`, `O4-Azure-AI`
- Fine-tuning plays → `T1-Fine-Tuning`, `T3-Production-Patterns`

### 3. Select WAF pillars

Every play must declare at least 1 WAF pillar. Most production plays need all 6. The FAI Engine loads matching `.instructions.md` files from `instructions/waf-*.instructions.md` automatically based on these declarations.

### 4. Wire primitives

Paths are relative to the play's root folder. Use `../../` to reference shared repo-level primitives:

```json
{
  "primitives": {
    "agents": ["./agent.md"],
    "instructions": [
      "./instructions.md",
      "../../instructions/python-waf.instructions.md"
    ],
    "skills": ["./.github/skills/deploy-my-play/"],
    "hooks": ["../../hooks/fai-secrets-scanner/"]
  }
}
```

### 5. Set guardrail thresholds

Guardrails define quality gates the FAI Engine evaluates after every agent response. Failures trigger retry or escalation:

| Threshold | Enterprise | Standard | Experimental |
|-----------|-----------|----------|--------------|
| `groundedness` | 0.95 | 0.85 | 0.70 |
| `coherence` | 0.90 | 0.80 | 0.70 |
| `relevance` | 0.85 | 0.75 | 0.60 |
| `safety` | 0 | 0 | 0 |
| `costPerQuery` | 0.01 | 0.05 | 0.10 |

`safety` is always 0 — zero tolerance for safety violations in all tiers.

### 6. Configure toolkit paths

The three kits partition play contents by audience:

| Kit | Path | Contains | Audience |
|-----|------|----------|----------|
| **DevKit** | `.github/` | Agents, instructions, prompts, skills, hooks, workflows | Developers building with Copilot |
| **TuneKit** | `config/` | `openai.json`, `guardrails.json`, `agents.json` — tunable AI params | Ops/ML engineers adjusting behavior |
| **SpecKit** | `spec/` | `fai-manifest.json`, `fai-context.json`, docs, architecture diagrams | Architects reviewing play design |

### 7. Add infrastructure (Azure plays only)

```json
{
  "infrastructure": {
    "bicep": "./infra/main.bicep",
    "parameters": "./infra/parameters.json"
  }
}
```

Non-Azure plays omit the `infrastructure` field entirely. Docker/K8s alternatives use `docker` or `kubernetes` keys instead.

## How Primitives Auto-Wire via Manifest

When the FAI Engine loads a manifest, it:

1. **Resolves context** — loads FROOT knowledge modules listed in `context.knowledge`
2. **Injects WAF** — activates WAF instruction files matching `context.waf` pillars
3. **Discovers primitives** — reads all paths in `primitives.*`, validates each file exists
4. **Applies guardrails** — wraps agent responses in quality-gate evaluation
5. **Binds toolkit** — maps DevKit/TuneKit/SpecKit paths for CLI and editor integration

Without the manifest, an agent is just a markdown file. With it, the agent inherits shared context, WAF enforcement, and quality gates automatically.

## Relationship to plugin.json

`fai-manifest.json` and `plugin.json` serve different roles:

| | `fai-manifest.json` | `plugin.json` |
|---|---|---|
| **Scope** | Full solution play | Single redistributable package |
| **Location** | `spec/fai-manifest.json` | `plugins/my-plugin/plugin.json` |
| **Contains** | Context wiring + all primitives + infra + toolkit | Package metadata + entry points |
| **Purpose** | FAI Engine runtime wiring | Marketplace distribution |

A plugin is extracted from a DevKit — it packages a subset of primitives for reuse across plays.

## Validation

Run the schema validator against your manifest:

```bash
# Validate a single manifest
node scripts/validate-primitives.js --verbose

# Quick JSON syntax check
node -e "JSON.parse(require('fs').readFileSync('solution-plays/42-custom-solution/spec/fai-manifest.json','utf8')); console.log('Valid JSON')"

# Validate play ID format
node -e "const m=require('./solution-plays/42-custom-solution/spec/fai-manifest.json'); if(!/^[0-9]{2}-[a-z0-9-]+$/.test(m.play)) throw 'Invalid play ID: '+m.play; console.log('Play ID OK:', m.play)"

# Check all primitive paths resolve
node -e "
const path=require('path'), fs=require('fs');
const root='solution-plays/42-custom-solution';
const m=require('./'+root+'/spec/fai-manifest.json');
['agents','instructions','skills','hooks'].forEach(k=>{
  (m.primitives[k]||[]).forEach(p=>{
    const abs=path.resolve(root,p);
    if(!fs.existsSync(abs)) console.error('MISSING:',abs);
    else console.log('OK:',abs);
  });
});
"
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Play ID uses underscores (`01_rag`) | Use hyphens: `01-enterprise-rag` |
| Guardrail threshold > 1.0 (e.g., `95`) | Use 0-1 range: `0.95` not `95` |
| Skill path points to SKILL.md file | Point to the *folder*: `./skills/my-skill/` not `./skills/my-skill/SKILL.md` |
| Missing `../../` for shared primitives | Local: `./agent.md`. Shared repo: `../../instructions/python-waf.instructions.md` |
| Adding `operational-excellence` as `ops-excellence` | Use exact enum: `operational-excellence` |
| `safety` set to `0.0` (float) | Must be integer `0` — schema enforces `maximum: 0` |
| Omitting `context.knowledge` | Required field, min 1 FROOT module reference |
| Putting manifest in play root | Goes in `spec/fai-manifest.json`, not play root |
- [Azure Best Practices](https://learn.microsoft.com/azure/well-architected/)
- [FAI Protocol](https://frootai.dev/fai-protocol)
