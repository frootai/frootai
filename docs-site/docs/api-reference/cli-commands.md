---
sidebar_position: 2
title: "CLI Commands"
description: "Reference for FrootAI CLI commands — scaffold plays, validate primitives, estimate costs, search knowledge, and compare solution plays from your terminal."
---

# CLI Commands

The FrootAI CLI provides terminal-based access to scaffolding, validation, search, and cost estimation. All commands run via `npx` — no global install required.

:::tip
For programmatic or agent-driven access to the same capabilities, use the [MCP Tools](./mcp-tools.md) instead.
:::

## Command Reference

| Command | Description |
|---------|-------------|
| `npx frootai scaffold <play>` | Initialize a solution play in current directory |
| `npx frootai validate --waf` | Validate WAF alignment of current play |
| `npm run validate:primitives` | Validate all primitives (agents, skills, hooks) |
| `npx frootai primitives --type <type>` | Browse primitives by type |
| `npx frootai evaluate` | Run evaluation pipeline |
| `npx frootai cost <play>` | Estimate Azure costs |
| `npx frootai search <query>` | Search knowledge base |
| `npx frootai compare <plays>` | Compare solution plays |

---

### `scaffold`

Initialize a solution play directory with the [golden template structure](./fai-manifest.md).

```bash
npx frootai scaffold <play-id>
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Target directory | `.` (current) |
| `--no-infra` | Skip infrastructure (Bicep) files | `false` |
| `--no-eval` | Skip evaluation pipeline | `false` |

**Example:**

```bash
npx frootai scaffold 01-enterprise-rag
```

```text
✔ Created .github/copilot-instructions.md
✔ Created .github/agents/builder.agent.md
✔ Created .github/agents/reviewer.agent.md
✔ Created .github/agents/tuner.agent.md
✔ Created .github/instructions/
✔ Created .github/skills/
✔ Created config/openai.json
✔ Created config/guardrails.json
✔ Created infra/main.bicep
✔ Created evaluation/
✔ Created fai-manifest.json
✔ Created agent.md
```

:::info
The scaffold follows the Play 101 golden template. See [fai-manifest.json](./fai-manifest.md) for the full structure specification and [JSON Schemas](./schemas.md) for field validation rules.
:::

---

### `validate --waf`

Validate that the current play aligns with the Azure Well-Architected Framework pillars declared in its `fai-manifest.json`.

```bash
npx frootai validate --waf
```

**Options:**

| Flag | Description |
|------|-------------|
| `--waf` | Check WAF pillar alignment |
| `--strict` | Fail on warnings (not just errors) |
| `--fix` | Auto-fix trivial issues (e.g., missing `applyTo`) |

**Example output:**

```text
Validating WAF alignment for play 01-enterprise-rag...
  ✔ reliability — 3 primitives aligned
  ✔ security — 5 primitives aligned
  ⚠ cost-optimization — missing token budget in config/openai.json
  ✔ operational-excellence — CI workflow present
  ✔ performance-efficiency — caching configured
  ✔ responsible-ai — content safety hook present
Result: 5 passed, 1 warning, 0 errors
```

---

### `validate:primitives`

Validate all primitives in the repository against their [JSON schemas](./schemas.md).

```bash
npm run validate:primitives
```

**What it checks:**

- File naming follows `lowercase-hyphen` convention
- YAML frontmatter has all required fields per type
- Skill folder names match the `name` field in frontmatter
- Hook events use only allowed event types
- Plugin `version` is valid semver

:::warning
Always run `validate:primitives` before committing. CI will reject PRs that fail validation with non-zero error count.
:::

---

### `primitives`

Browse primitives by type interactively.

```bash
npx frootai primitives --type <type>
```

**Supported types:** `agents`, `instructions`, `skills`, `hooks`, `plugins`, `workflows`, `cookbook`

**Example:**

```bash
npx frootai primitives --type agents
```

---

### `evaluate`

Run the evaluation pipeline for the current play against configured thresholds.

```bash
npx frootai evaluate
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--threshold <n>` | Override default threshold | `4.0` |
| `--metrics` | Comma-separated metrics list | all |

Thresholds are loaded from `config/guardrails.json`. See [JSON Schemas](./schemas.md) for the guardrails schema.

---

### `cost`

Estimate monthly Azure costs for a solution play.

```bash
npx frootai cost <play-number> [--scale <dev|prod>]
```

**Example:**

```bash
npx frootai cost 01 --scale prod
```

```text
Play 01 — Enterprise RAG (prod scale)
──────────────────────────────────────
Azure OpenAI (GPT-4o)      $800/mo
Azure AI Search (S1)        $250/mo
Azure App Service (P1v3)    $140/mo
Azure Cosmos DB (Serverless)  $50/mo
──────────────────────────────────────
Total                     $1,240/mo
```

---

### `search`

Search the FrootAI knowledge base from your terminal.

```bash
npx frootai search "<query>"
```

**Example:**

```bash
npx frootai search "RAG chunking strategies"
```

---

### `compare`

Compare two or three solution plays side-by-side.

```bash
npx frootai compare <play1>,<play2>[,<play3>]
```

**Example:**

```bash
npx frootai compare 01,07
```

---

## Related Pages

- [MCP Tools Reference](./mcp-tools.md) — programmatic access to the same capabilities
- [JSON Schemas](./schemas.md) — validation rules for all FrootAI files
- [fai-manifest.json](./fai-manifest.md) — the play wiring specification
