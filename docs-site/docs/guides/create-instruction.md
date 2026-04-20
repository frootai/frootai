---
sidebar_position: 3
title: Create an Instruction
description: Build a .instructions.md file with WAF alignment and glob-based applyTo targeting for auto-applied coding standards.
---

# Create an Instruction

Build a production-quality instruction file that Copilot auto-applies whenever you edit matching files.

## Prerequisites

- FrootAI repo cloned
- VS Code with GitHub Copilot Chat
- Node.js 22+

## Step 1: Understand the Frontmatter

Every instruction requires YAML frontmatter:

```yaml
---
description: "What this instruction enforces (minimum 10 characters)"
applyTo: "**/*.py"
waf:
  - "security"
  - "reliability"
---
```

| Field | Required | Validation |
|-------|----------|------------|
| `description` | ✅ | Minimum 10 characters |
| `applyTo` | ✅ | Valid glob pattern |
| `waf` | No | Valid WAF pillar names |

## Step 2: Choose Your applyTo Pattern

| Pattern | Matches | Use Case |
|---------|---------|----------|
| `**/*.py` | All Python files | Python coding standards |
| `**/*.{ts,tsx}` | TypeScript + TSX | React/TypeScript standards |
| `**/*.bicep` | All Bicep files | IaC best practices |
| `solution-plays/01-*/**` | Play 01 files only | Per-play targeting |
| `**/infra/**/*.bicep` | Infra Bicep only | Infrastructure rules |

## Step 3: Use the Scaffolder

```bash
node scripts/scaffold-primitive.js instruction
```

Follow the prompts:
- **Name:** `python-azure-waf`
- **Description:** "Python best practices for Azure AI services"
- **applyTo:** `**/*.py`

## Step 4: Write the Body

Include **specific, actionable rules** with **code examples**:

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

- Use `DefaultAzureCredential` for all Azure authentication:
  ​```python
  from azure.identity import DefaultAzureCredential
  credential = DefaultAzureCredential()
  ​```
- Never hardcode keys or connection strings

## Reliability

- Add retry with exponential backoff on all Azure SDK calls:
  ​```python
  from tenacity import retry, stop_after_attempt, wait_exponential

  @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
  async def call_openai(prompt: str) -> str:
      return await client.chat.completions.create(...)
  ​```

## Cost Optimization

- Always set `max_tokens` on LLM calls to prevent budget overruns
- Route by complexity: GPT-4o-mini for classification, GPT-4o for generation
```

:::tip Copilot Follows Examples
Include concrete code patterns. Copilot learns from examples in the instruction body better than from abstract prose.
:::

## Step 5: Test in VS Code

1. Open a `.py` file (matching your `applyTo` pattern)
2. Start a Copilot Chat conversation
3. Verify suggestions follow your instruction rules
4. Ask `@workspace "What instructions apply to this file?"`

## Step 6: Validate

```bash
npm run validate:primitives
```

:::warning Keep Under 200 Lines
Instructions are loaded into the LLM context window. Shorter instructions use fewer tokens and get applied more reliably.
:::

## Advanced: Multi-Scope

Target multiple file types:

```yaml
---
description: "Full-stack WAF standards"
applyTo: "**/*.{ts,tsx,py}"
waf: ["security", "reliability"]
---
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Instruction not applied | Verify glob matches your file |
| Validator says "description too short" | Expand to 10+ characters |
| YAML parse error | Add space after colons: `description: "text"` |
| Copilot ignores rules | Add code examples instead of prose |

## See Also

- [Instructions Reference](/primitives/instructions) — full specification
- [Well-Architected Framework](/concepts/well-architected) — WAF pillars
