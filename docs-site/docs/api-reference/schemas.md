---
sidebar_position: 3
title: "JSON Schemas"
description: "Validation schemas for all FrootAI primitives — fai-manifest.json, fai-context.json, agent frontmatter, skill frontmatter, instruction frontmatter, hook schema, and plugin schema."
---

# JSON Schemas

Every FrootAI primitive has a defined schema. These schemas are enforced by `npm run validate:primitives` and in CI. This page documents each schema with required fields and examples.

:::tip
For the complete `fai-manifest.json` deep-dive, see the dedicated [fai-manifest.json](./fai-manifest.md) reference page.
:::

---

## 1. fai-manifest.json — Play Wiring

The top-level manifest that wires context, primitives, infrastructure, and toolkit for a solution play. Think of it as the **"package.json for AI solution plays"**.

**Required fields:**

| Field | Type | Description |
|-------|------|-------------|
| `play` | string | Format: `NN-kebab-case` (e.g., `01-enterprise-rag`) |
| `version` | string | Semver (e.g., `1.0.0`) |
| `context.knowledge` | string[] | Knowledge files referenced |
| `context.waf` | string[] | WAF pillars aligned to |
| `primitives` | object | Agents, instructions, skills, hooks, workflows |

**Guardrails thresholds** are float values between `0` and `1`.

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["copilot-instructions.md"],
    "waf": ["reliability", "security"],
    "assumes": ["azure-subscription"]
  },
  "primitives": {
    "agents": ["./.github/agents/builder.agent.md"],
    "skills": ["./.github/skills/rag-indexing/SKILL.md"]
  },
  "guardrails": {
    "thresholds": { "groundedness": 0.8, "relevance": 0.7 }
  }
}
```

:::info
See the full specification with all fields at [fai-manifest.json](./fai-manifest.md).
:::

---

## 2. fai-context.json — Lightweight Context Block

A lightweight "LEGO block" that any primitive can carry to declare its assumptions and compatibility. Unlike `fai-manifest.json`, this is not play-level — it lives alongside individual primitives.

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assumes` | string[] | ❌ | Prerequisites (e.g., `azure-openai`, `python-3.11`) |
| `waf` | string[] | ❌ | WAF pillar alignment |
| `compatible-plays` | string[] | ❌ | Play IDs this primitive works with |

```json
{
  "assumes": ["azure-openai", "azure-ai-search"],
  "waf": ["reliability", "security", "performance-efficiency"],
  "compatible-plays": ["01-enterprise-rag", "21-agentic-rag"]
}
```

---

## 3. Agent Frontmatter (`.agent.md`)

Agent files use YAML frontmatter at the top of the Markdown file.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `description` | string | ✅ | 10+ characters |
| `name` | string | ❌ | Display name |
| `model` | string[] | ❌ | Preferred models (e.g., `["gpt-4o", "gpt-4o-mini"]`) |
| `tools` | string[] | ❌ | Tools the agent can use |
| `waf` | string[] | ❌ | WAF pillar alignment |
| `plays` | string[] | ❌ | Compatible solution plays |

```yaml
---
description: "RAG pipeline design — chunking, indexing, retrieval, reranking"
name: "FAI RAG Architect"
model: ["gpt-4o", "gpt-4o-mini"]
tools: ["codebase", "terminal", "search"]
waf: ["reliability", "performance-efficiency"]
plays: ["01-enterprise-rag", "21-agentic-rag"]
---

# FAI RAG Architect

Detailed agent instructions follow here...
```

:::warning
The `description` field is **required** and must be at least 10 characters. Agents missing this field will fail `validate:primitives`.
:::

---

## 4. Skill Frontmatter (`SKILL.md`)

Skills live in named folders. The `name` in frontmatter **must match** the parent folder name.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | Kebab-case, must equal parent folder name |
| `description` | string | ✅ | 10–1024 characters |

```yaml
---
name: "fai-play-initializer"
description: "Scaffolds a new solution play with the golden template structure, creating all required files and directories."
---

# FAI Play Initializer

## Steps
1. Read the target play number
2. Create the directory structure
3. Generate fai-manifest.json
```

File path: `.github/skills/fai-play-initializer/SKILL.md`

---

## 5. Instruction Frontmatter (`.instructions.md`)

Instructions are context files applied to matching file patterns via `applyTo` globs.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `description` | string | ✅ | 10+ characters |
| `applyTo` | string | ✅ | Glob pattern (e.g., `**/*.py`) |
| `waf` | string[] | ❌ | WAF pillar alignment |

```yaml
---
description: "Security best practices for all code files per Azure WAF"
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
waf: ["security"]
---

# Security Instructions

- Never hardcode secrets or API keys
- Use Managed Identity for service-to-service auth
```

---

## 6. Hook Schema (`hooks.json`)

Hooks define event-driven automation that runs at specific lifecycle points.

**Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | number | ✅ | Must be `1` |
| `hooks` | object[] | ✅ | At least one event handler |

**Allowed event types:** `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PreCompact`, `SubagentStart`, `SubagentStop`, `Stop`

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "SessionStart",
      "command": "node .github/hooks/scan-secrets.js",
      "description": "Scan for leaked secrets at session start"
    }
  ]
}
```

:::warning
**Never use `PreToolUse` hooks** in production — they spawn a process per tool call, adding ~5 seconds of latency each. Prefer `SessionStart` for initialization checks.
:::

---

## 7. Plugin Schema (`plugin.json`)

Plugins are distributable DevKit packages.

**Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | Must match parent folder name |
| `description` | string | ✅ | — |
| `version` | string | ✅ | Valid semver (e.g., `1.0.0`) |
| `author.name` | string | ✅ | — |
| `license` | string | ✅ | SPDX identifier |

```json
{
  "name": "enterprise-rag",
  "description": "Enterprise RAG pipeline plugin with Azure AI Search integration",
  "version": "1.2.0",
  "author": {
    "name": "FrootAI"
  },
  "license": "MIT"
}
```

---

## Validation

Run schema validation locally before committing:

```bash
npm run validate:primitives
```

See [CLI Commands](./cli-commands.md) for more validation options and [fai-manifest.json](./fai-manifest.md) for the full manifest specification.
