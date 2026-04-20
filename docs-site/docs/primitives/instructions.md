---
sidebar_position: 2
title: Instructions
description: Auto-applied coding standards scoped by file glob patterns — .instructions.md files that enforce WAF-aligned rules whenever matching files are edited.
---

# Instructions

Instructions are **persistent coding standards** that Copilot applies automatically based on the files you're editing. Unlike agents (which you invoke) or skills (which execute steps), instructions activate passively via `applyTo` glob patterns.

## How Instructions Work

When you open a file in VS Code, Copilot checks all `.instructions.md` files to see if any `applyTo` pattern matches your file. Matching instructions are loaded into the conversation context, so Copilot follows those rules when generating or editing code.

```
You open `src/api.py`
  → Copilot checks all .instructions.md files
  → `applyTo: "**/*.py"` matches!
  → Instruction rules are loaded into context
  → Copilot generates code following those standards
```

## File Structure

Instructions live in `instructions/` (or `.github/instructions/` inside a play):

```markdown title="instructions/python-azure-waf.instructions.md"
---
description: "Enforces Python best practices for Azure AI services — security, reliability, and cost optimization patterns."
applyTo: "**/*.py"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
---

# Python Azure AI Coding Standards

## Security

- Use `DefaultAzureCredential` for all Azure authentication — never hardcode keys
- Load secrets from environment variables or Azure Key Vault, never from code

## Reliability

- Add retry with exponential backoff on all Azure SDK and HTTP calls
- Set explicit timeouts — never rely on client defaults
```

## Frontmatter Schema

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `description` | ✅ | string | Minimum 10 characters |
| `applyTo` | ✅ | string | Valid glob pattern |
| `waf` | No | string[] | Valid WAF pillar names |

## applyTo Glob Patterns

The `applyTo` pattern determines which files trigger the instruction:

| Pattern | Matches | Use Case |
|---------|---------|----------|
| `**/*.py` | All Python files | Python coding standards |
| `**/*.{ts,tsx}` | TypeScript + TSX | React/TypeScript standards |
| `**/*.bicep` | All Bicep files | IaC best practices |
| `**/*.{yaml,yml}` | YAML files | Config/pipeline standards |
| `**/test_*.py` | Python test files | Testing patterns |
| `solution-plays/01-*/**` | Play 01 files only | Per-play targeting |
| `**/infra/**/*.bicep` | Infra Bicep only | Infrastructure rules |

**Glob rules:**
- `*` matches any characters except `/`
- `**` matches any characters including `/` (recursive)
- `{a,b}` matches either `a` or `b`

## WAF Instructions

FrootAI ships with instructions for each Well-Architected Framework pillar:

| Instruction | Pillar | Applies To |
|-------------|--------|-----------|
| `waf-security.instructions.md` | Security | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| `waf-reliability.instructions.md` | Reliability | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| `waf-cost-optimization.instructions.md` | Cost | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| `waf-operational-excellence.instructions.md` | Ops Excellence | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| `waf-performance-efficiency.instructions.md` | Performance | `**/*.{ts,js,py,bicep,json,yaml,yml}` |
| `waf-responsible-ai.instructions.md` | Responsible AI | `**/*.{ts,js,py,bicep,json,yaml,yml}` |

:::info WAF Security Example
The `waf-security` instruction enforces: never hardcode secrets, use Managed Identity, implement RBAC, enable private endpoints, rate-limit AI API calls, and pin dependency versions. These rules auto-apply to every code file.
:::

## Writing Effective Instructions

Copilot follows examples better than prose. Include concrete code patterns:

```markdown
## Authentication — Always Use Managed Identity

✅ Correct:
```python
from azure.identity import DefaultAzureCredential
credential = DefaultAzureCredential()
```

❌ Wrong:
```python
api_key = "sk-abc123..."  # NEVER hardcode keys
```
```

:::tip Keep Under 200 Lines
Instructions are loaded into the LLM context window. Shorter instructions use fewer tokens and get applied more reliably. One concern per instruction file.
:::

## Multi-Scope Instructions

Target multiple file types with a single glob:

```yaml
---
description: "Full-stack WAF standards for TypeScript frontend and Python backend"
applyTo: "**/*.{ts,tsx,py}"
waf: ["security", "reliability", "performance-efficiency"]
---
```

For play-specific instructions:

```yaml
---
description: "Play 01 Enterprise RAG implementation standards"
applyTo: "solution-plays/01-enterprise-rag/**/*.{py,ts,bicep}"
---
```

## Validation

```bash
npm run validate:primitives
```

This checks that every instruction has:
- `description` with 10+ characters
- Valid `applyTo` glob pattern
- Correct lowercase-hyphen filename

## See Also

- [Create an Instruction Guide](/docs/guides/create-instruction) — step-by-step tutorial
- [Well-Architected Framework](/docs/concepts/well-architected) — the 6 pillars
- [Primitives Overview](/docs/concepts/primitives) — all 6 primitive types
