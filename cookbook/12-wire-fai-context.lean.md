# Recipe 12: Wire FAI Context (LEGO Blocks)

> Connect standalone primitives into the FAI Protocol using `fai-manifest.json` and `fai-context.json` — the wiring layer that makes AI primitives context-aware.

## What You'll Build

A wired FAI context linking standalone primitives (agents, instructions, skills) to FROOT knowledge modules, WAF pillars, and solution plays; you’ll distinguish manifest vs. context, configure auto-wiring, debug resolution, and validate the chain.

## Manifest vs. Context: When to Use Which

FrootAI has two wiring files; the difference matters:

| Aspect | `fai-manifest.json` | `fai-context.json` |
|--------|---------------------|---------------------|
| **Level** | Solution play (top-level) | Individual primitive (standalone) |
| **Location** | `solution-plays/NN-name/fai-manifest.json` | Next to any agent, instruction, or skill |
| **Purpose** | Wires ALL primitives + infra + toolkit for a play | Declares context needs for ONE primitive |
| **Analogy** | Docker Compose (full stack) | Single Dockerfile (one service) |
| **Contains** | Primitives, guardrails, infrastructure, toolkit refs | Knowledge assumptions, WAF pillars, play compatibility |
| **Required** | Yes, for every solution play | No, optional for standalone primitives |

**Rule of thumb:**
- Building a **solution play**? → Create `fai-manifest.json`
- Building a **standalone primitive** that needs context? → Create `fai-context.json`
- The FAI Engine reads manifests first, then resolves context files for each referenced primitive

## Prerequisites

- FrootAI repo cloned
- At least one primitive to wire (agent, instruction, or skill)
- Node.js 22+ (for FAI Engine validation)

## Steps

### 1. Decide: manifest, context, or both

| Scenario | File(s) |
|----------|---------|
| New solution play | `fai-manifest.json` (required) |
| Standalone agent in `agents/` | `fai-context.json` (optional, in subfolder) |
| Agent that lives inside a play | The play's `fai-manifest.json` references it — no separate context needed |
| Standalone skill reused across plays | `fai-context.json` (recommended, declares compatibility) |

### 2. Create fai-context.json for a standalone primitive

Put the context file in a subfolder named after the primitive:

```
agents/
  frootai-rag-architect.agent.md       # The agent itself
  frootai-rag-architect/
    fai-context.json                    # Context for this agent
```

**Minimal context:**

```json
{
  "assumes": [
    "R2-RAG-Architecture"
  ]
}
```

**Full context:**

```json
{
  "$schema": "https://frootai.dev/schemas/fai-context.schema.json",
  "assumes": [
    "R2-RAG-Architecture",
    "O3-MCP-Tools-Functions",
    "T2-Responsible-AI"
  ],
  "waf": [
    "security",
    "reliability",
    "cost-optimization",
    "responsible-ai"
  ],
  "compatiblePlays": [
    "01-enterprise-rag",
    "09-ai-search-portal",
    "21-agentic-rag"
  ],
  "evaluation": {
    "groundedness": 0.95,
    "coherence": 0.90,
    "safety": 0.99
  }
}
```

### 3. Understand the `assumes` field

`assumes` names the FROOT knowledge modules your primitive needs; the FAI Engine uses it to load relevant training context.

**Complete FROOT module reference:**

| Series | ID | Module Name | Content |
|--------|----|-------------|---------|
| **F** (Foundations) | `F1` | GenAI Foundations | Transformer architecture, attention, tokenization |
| | `F2` | LLM Selection | Model comparison, benchmarks, pricing |
| | `F3` | AI Glossary | 200+ AI terms defined |
| | `F4` | GitHub Agentic OS | Copilot ecosystem, MCP, A2A |
| **R** (Reasoning) | `R1` | Prompt Patterns | CoT, few-shot, tree-of-thought |
| | `R2` | RAG Architecture | Ingestion, retrieval, generation, hybrid search |
| | `R3` | Deterministic AI | FSMs, guardrails, reproducibility |
| **O** (Orchestration) | `O1` | Semantic Kernel | Plugins, planners, memory |
| | `O2` | Agent Coding | Agent patterns, tool use, loops |
| | `O3` | MCP Tools | MCP protocol, tool schemas, FastMCP |
| | `O4` | Foundry Config | Azure AI Foundry setup |
| | `O5` | GPU Infrastructure | GPU provisioning, AKS, ACA |
| | `O6` | Copilot Extend | Extensions, declarative agents |
| **T** (Transformation) | `T1` | Fine-Tuning + MLOps | Dataset prep, training, evaluation |
| | `T2` | Responsible AI | Content safety, bias, transparency |
| | `T3` | Production Deploy | Blue-green, canary, rollback |

**Example mappings:**

| Primitive Type | Typical Modules |
|---------------|-----------------|
| RAG agent | `R2`, `R1`, `T2` |
| MCP tool builder | `O3`, `F4` |
| Infrastructure skill | `O5`, `T3` |
| Evaluation agent | `T1`, `T2`, `R3` |
| Prompt engineer | `R1`, `F1`, `F2` |

### 4. Declare WAF alignment

`waf` lists the Well-Architected Framework pillars enforced by the primitive. Valid values:

```json
{
  "waf": [
    "security",
    "reliability",
    "cost-optimization",
    "operational-excellence",
    "performance-efficiency",
    "responsible-ai"
  ]
}
```

Only claim pillars the primitive actually covers. The FAI Engine unions all primitives' WAF declarations when loading a play.

### 5. Declare play compatibility

`compatiblePlays` lists which solution plays the primitive integrates with:

```json
{
  "compatiblePlays": [
    "01-enterprise-rag",
    "05-it-ticket-resolution",
    "21-agentic-rag",
    "42-multi-region-rag"
  ]
}
```

The FAI Engine warns if a play references a primitive that doesn't list it as compatible. This is advisory, not blocking — it flags mismatches.

### 6. Create a fai-manifest.json for a play

Manifests are the top-level wiring for solution plays. Example for Play 01:

```json
{
  "$schema": "https://frootai.dev/schemas/fai-manifest.schema.json",
  "play": "01-enterprise-rag",
  "version": "2.0.0",
  "context": {
    "knowledge": [
      "R2-RAG-Architecture",
      "R1-Prompt-Patterns",
      "O3-MCP-Tools-Functions",
      "T2-Responsible-AI"
    ],
    "waf": [
      "security",
      "reliability",
      "cost-optimization",
      "operational-excellence",
      "responsible-ai"
    ],
    "scope": "Enterprise RAG with Azure AI Search, GPT-4o, and managed identity"
  },
  "primitives": {
    "agents": [
      "../../agents/frootai-rag-architect.agent.md",
      "./.github/agents/rag-builder.agent.md"
    ],
    "instructions": [
      "../../instructions/python-waf.instructions.md",
      "./.github/instructions/rag-patterns.instructions.md"
    ],
    "skills": [
      "../../skills/frootai-build-genai-rag/",
      "../../skills/frootai-evaluate-01-enterprise-rag/"
    ],
    "hooks": [
      "../../hooks/frootai-secrets-scanner/",
      "../../hooks/frootai-tool-guardian/",
      "../../hooks/frootai-governance-audit/"
    ],
    "guardrails": {
      "groundedness": 0.95,
      "coherence": 0.90,
      "relevance": 0.85,
      "safety": 0.99,
      "costPerQuery": 0.015
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

### 7. Understand the context resolution chain

When the FAI Engine loads a play, it resolves in this order:

```
1. Read fai-manifest.json
   ├── Load context.knowledge[] → FROOT modules
   ├── Load context.waf[] → WAF pillar rules
   │
2. Resolve each primitive reference
   ├── agents/frootai-rag-architect.agent.md
   │   └── Check: agents/frootai-rag-architect/fai-context.json
   │       ├── Merge assumes[] into knowledge set
   │       ├── Union waf[] with manifest waf
   │       └── Verify compatiblePlays includes this play
   │
   ├── skills/frootai-build-genai-rag/
   │   └── Check: skills/frootai-build-genai-rag/fai-context.json
   │       └── (same merge logic)
   │
3. Apply guardrails from manifest
   └── groundedness ≥ 0.95, safety ≥ 0.99, etc.

4. Report: all primitives wired, X modules loaded, Y pillars enforced
```

**Conflict resolution:**
- Knowledge modules: **union** of all sources (manifest + all context files)
- WAF pillars: **union** of all sources
- Guardrails: **manifest wins** — primitive-level evaluation thresholds are advisory
- Play compatibility: **warn** if a primitive doesn't list the current play — don't block

### 8. Debug context wiring

```bash
# Load a play and print detailed resolution
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status --verbose

# Check a specific context file parses
node -e "
const ctx = require('./agents/frootai-rag-architect/fai-context.json');
console.log('Assumes:', ctx.assumes?.length || 0, 'modules');
console.log('  →', (ctx.assumes || []).join(', '));
console.log('WAF:', ctx.waf?.join(', ') || 'none');
console.log('Plays:', ctx.compatiblePlays?.join(', ') || 'none');
if (ctx.evaluation) {
  console.log('Evaluation:', JSON.stringify(ctx.evaluation));
}
console.log('✅ Context valid');
"

# Find all context files in the repo
find . -name "fai-context.json" -not -path "*/node_modules/*" | sort
```

### 9. Validate the full wiring chain

```bash
# Validate all primitives (frontmatter, naming, schema)
npm run validate:primitives

# Load the play in the FAI Engine
node engine/index.js solution-plays/01-enterprise-rag/fai-manifest.json --status
```

Expected FAI Engine output:

```
🍊 FAI Engine v0.1
══════════════════════════════════════════════════
  Play:      01-enterprise-rag v2.0.0
  Knowledge: 4 FROOT modules (R2, R1, O3, T2)
  WAF:       5 pillars enforced
  Agents:    2 wired (1 with context)
  Skills:    2 wired
  Hooks:     3 security hooks active
  Guardrails: groundedness≥0.95, safety≥0.99
  ✅ All primitives wired, context resolved
══════════════════════════════════════════════════
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Engine says "0 modules loaded" | `context.knowledge` missing or empty | Add FROOT module IDs to the `knowledge` array |
| "Primitive not found" warning | Relative path doesn't resolve | Paths are relative to the manifest file location; use `../../` for repo-root primitives |
| Context file ignored | Not in the expected subfolder | `fai-context.json` must be in a subfolder named after the primitive |
| WAF count lower than expected | Primitive context files not found | Create `fai-context.json` for primitives that declare WAF pillars |
| "Incompatible play" warning | Primitive's `compatiblePlays` doesn't list this play | Add the play name to the primitive's `fai-context.json` |
| JSON parse error | Trailing comma or syntax error | Validate: `node -e "require('./path/to/file.json')"` |
| Guardrails not applied | Missing `guardrails` object in manifest | Add the `guardrails` block under `primitives` |

## Best Practices

1. **Declare only what you need** — don't list all 16 FROOT modules in `assumes`
2. **Be honest about WAF** — only claim pillars your primitive actually enforces
3. **List specific plays** — use exact play names, not wildcards
4. **Set realistic thresholds** — 0.95 groundedness is achievable for RAG; 0.99 is ambitious
5. **Keep context files minimal** — `fai-context.json` should be under 20 lines
6. **Manifest is authoritative** — when guardrails conflict, the manifest wins
7. **Validate after every wiring change** — run `npm run validate:primitives` and the FAI Engine
8. **Use $schema** — enables IDE autocompletion and inline validation for both file types
9. **Context is optional** — not every standalone primitive needs a `fai-context.json`; add it when the primitive has knowledge dependencies or cross-play compatibility
