---
sidebar_position: 4
title: "fai-manifest.json"
description: "Complete specification for fai-manifest.json — the 'package.json for AI solution plays' that wires context, primitives, infrastructure, toolkit, and guardrails."
---

# fai-manifest.json

The `fai-manifest.json` is the **"package.json for AI solution plays"**. It wires together context, primitives, infrastructure, toolkit configuration, and guardrails into a single declarative manifest.

Every solution play **must** have a `fai-manifest.json` at its root. It is the single source of truth for what a play contains and how it connects to the FrootAI ecosystem.

:::tip
To scaffold a play with a pre-populated `fai-manifest.json`, run `npx frootai scaffold <play-id>`. See [CLI Commands](./cli-commands.md).
:::

---

## Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `play` | string | ✅ | Play identifier — format `NN-kebab-case` |
| `version` | string | ✅ | Semver version (e.g., `1.0.0`) |
| `context` | object | ✅ | Knowledge, WAF alignment, prerequisites |
| `primitives` | object | ✅ | Agents, instructions, skills, hooks, workflows |
| `infrastructure` | object | ❌ | Cloud provider, services, IaC config |
| `toolkit` | object | ❌ | DevKit / TuneKit / SpecKit flags |
| `guardrails` | object | ❌ | AI quality thresholds |

---

## `play`

The unique play identifier. Format: `NN-kebab-case` where `NN` is a zero-padded number.

```json
"play": "01-enterprise-rag"
```

---

## `version`

Semantic version of the play. Bump when primitives, infrastructure, or config change.

```json
"version": "1.0.0"
```

---

## `context`

Declares what knowledge the play carries, which WAF pillars it aligns to, and what prerequisites it assumes.

### `context.knowledge`

Array of knowledge file paths referenced by the play. These are loaded into the AI context.

```json
"knowledge": [
  "copilot-instructions.md",
  "docs/architecture.md"
]
```

### `context.waf`

Array of Well-Architected Framework pillars the play aligns to. Valid values:

- `reliability`
- `security`
- `cost-optimization`
- `operational-excellence`
- `performance-efficiency`
- `responsible-ai`

```json
"waf": ["reliability", "security", "cost-optimization", "responsible-ai"]
```

### `context.assumes`

Array of prerequisites the play requires. These are checked during validation.

```json
"assumes": [
  "azure-subscription",
  "azure-openai",
  "azure-ai-search",
  "node-20"
]
```

---

## `primitives`

Maps each primitive type to an array of relative file paths within the play directory.

### `primitives.agents`

```json
"agents": [
  "./agent.md",
  "./.github/agents/builder.agent.md",
  "./.github/agents/reviewer.agent.md",
  "./.github/agents/tuner.agent.md"
]
```

### `primitives.instructions`

```json
"instructions": [
  "./.github/instructions/rag-patterns.instructions.md",
  "./.github/instructions/azure-security.instructions.md"
]
```

### `primitives.skills`

```json
"skills": [
  "./.github/skills/rag-indexing/SKILL.md",
  "./.github/skills/rag-retrieval/SKILL.md"
]
```

### `primitives.hooks`

```json
"hooks": [
  "./.github/hooks/content-safety/hooks.json"
]
```

### `primitives.workflows`

```json
"workflows": [
  "./.github/workflows/deploy.yml",
  "./.github/workflows/evaluate.yml"
]
```

:::warning
All paths are **relative to the play root** where `fai-manifest.json` lives. Use `./` prefix for clarity.
:::

---

## `infrastructure`

Declares the cloud infrastructure required by the play.

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | `"azure"`, `"aws"`, or `"gcp"` |
| `services` | string[] | Service identifiers used |
| `iac` | object | Infrastructure-as-Code configuration |
| `iac.type` | string | `"bicep"` or `"terraform"` |
| `iac.entrypoint` | string | Path to main IaC file |

```json
"infrastructure": {
  "provider": "azure",
  "services": [
    "azure-openai",
    "azure-ai-search",
    "azure-app-service",
    "azure-cosmos-db",
    "azure-key-vault"
  ],
  "iac": {
    "type": "bicep",
    "entrypoint": "./infra/main.bicep"
  }
}
```

---

## `toolkit`

Flags indicating which toolkit layers are included in the play.

| Field | Type | Description |
|-------|------|-------------|
| `devkit` | boolean | Developer toolkit — agents, skills, instructions |
| `tunekit` | boolean | Tuning toolkit — `config/openai.json`, `config/guardrails.json` |
| `speckit` | boolean | Spec toolkit — metadata, docs, `fai-manifest.json` |

```json
"toolkit": {
  "devkit": true,
  "tunekit": true,
  "speckit": true
}
```

---

## `guardrails`

AI quality thresholds for the evaluation pipeline. All values are floats between **0** and **1**.

| Metric | Description | Typical Threshold |
|--------|-------------|-------------------|
| `groundedness` | Response grounded in provided context | `0.8` |
| `relevance` | Response relevant to the query | `0.7` |
| `coherence` | Logical consistency of response | `0.7` |
| `fluency` | Language quality | `0.8` |
| `safety` | Content safety score | `0.9` |

```json
"guardrails": {
  "thresholds": {
    "groundedness": 0.8,
    "relevance": 0.7,
    "coherence": 0.7,
    "fluency": 0.8,
    "safety": 0.9
  }
}
```

:::tip
Use the [MCP `run_evaluation` tool](./mcp-tools.md) or `npx frootai evaluate` to check scores against these thresholds automatically.
:::

---

## Complete Example — Play 01 (Enterprise RAG)

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": [
      "copilot-instructions.md",
      "docs/rag-architecture.md"
    ],
    "waf": [
      "reliability",
      "security",
      "cost-optimization",
      "operational-excellence",
      "performance-efficiency",
      "responsible-ai"
    ],
    "assumes": [
      "azure-subscription",
      "azure-openai",
      "azure-ai-search",
      "azure-cosmos-db",
      "node-20"
    ]
  },
  "primitives": {
    "agents": [
      "./agent.md",
      "./.github/agents/builder.agent.md",
      "./.github/agents/reviewer.agent.md",
      "./.github/agents/tuner.agent.md"
    ],
    "instructions": [
      "./.github/instructions/rag-patterns.instructions.md",
      "./.github/instructions/azure-security.instructions.md"
    ],
    "skills": [
      "./.github/skills/rag-indexing/SKILL.md",
      "./.github/skills/rag-retrieval/SKILL.md",
      "./.github/skills/rag-evaluation/SKILL.md"
    ],
    "hooks": [
      "./.github/hooks/content-safety/hooks.json"
    ],
    "workflows": [
      "./.github/workflows/deploy.yml",
      "./.github/workflows/evaluate.yml"
    ]
  },
  "infrastructure": {
    "provider": "azure",
    "services": [
      "azure-openai",
      "azure-ai-search",
      "azure-app-service",
      "azure-cosmos-db",
      "azure-key-vault",
      "azure-monitor"
    ],
    "iac": {
      "type": "bicep",
      "entrypoint": "./infra/main.bicep"
    }
  },
  "toolkit": {
    "devkit": true,
    "tunekit": true,
    "speckit": true
  },
  "guardrails": {
    "thresholds": {
      "groundedness": 0.8,
      "relevance": 0.7,
      "coherence": 0.7,
      "fluency": 0.8,
      "safety": 0.9
    }
  }
}
```

---

## fai-manifest.json vs fai-context.json

:::info Relationship between manifest and context
**`fai-manifest.json`** is the **play-level** manifest — it lives at the root of a solution play and wires everything together: context, all primitives, infrastructure, toolkit, and guardrails. There is exactly **one per play**.

**`fai-context.json`** is a **primitive-level** context block — a lightweight "LEGO piece" that any individual primitive (agent, skill, hook) can carry to declare its own assumptions, WAF alignment, and compatible plays. There can be **many per play**, one alongside each primitive.

When the FAI Engine loads a play, it merges all `fai-context.json` blocks from referenced primitives into the play's unified context, with `fai-manifest.json` as the authoritative root.

See the [JSON Schemas](./schemas.md) page for the `fai-context.json` field reference.
:::

---

## Validation

Validate your manifest locally:

```bash
npm run validate:primitives
```

The validator checks:
- `play` matches `NN-kebab-case` format
- `version` is valid semver
- `context.waf` values are valid pillar names
- `guardrails.thresholds` values are between 0 and 1
- All file paths in `primitives` resolve to existing files

See [CLI Commands](./cli-commands.md) for additional validation options.
