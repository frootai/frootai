# Recipe 9: Create a Custom Instruction

> Build a standalone `.instructions.md` file with WAF alignment, glob-based `applyTo` targeting, and per-language coding standards.

## What You'll Build

A production-quality instruction file Copilot auto-applies to matching files. You’ll define frontmatter, pick precise globs, write WAF-aligned rules with examples, test in VS Code, and publish to the FrootAI ecosystem.

## What Are Instructions?

Instructions are **persistent coding standards** Copilot applies automatically based on edited files. Unlike agents (invoked) or skills (execute steps), instructions activate passively via `applyTo` glob patterns.

| Aspect | Agent | Instruction | Skill |
|--------|-------|-------------|-------|
| Activation | User invokes `@agent` | Auto-applied by glob | User invokes or agent calls |
| Scope | Conversation | Every matching file | Task execution |
| Purpose | Interactive persona | Coding standards | Step-by-step procedure |
| Format | `.agent.md` | `.instructions.md` | Folder with `SKILL.md` |
| Location | `agents/` or `.github/agents/` | `instructions/` or `.github/instructions/` | `skills/` |

## Prerequisites

- FrootAI repo cloned
- VS Code with GitHub Copilot Chat extension
- Node.js 22+ (for validation)

## Steps

### 1. Understand the frontmatter schema

Every instruction file requires YAML frontmatter with these fields:

```yaml
---
# REQUIRED
description: "What this instruction enforces (minimum 10 characters)"
applyTo: "**/*.py"          # Glob pattern — which files trigger this instruction

# OPTIONAL
waf:                        # WAF pillars this instruction covers
  - "security"
  - "reliability"
---
```

| Field | Required | Type | Validation |
|-------|----------|------|------------|
| `description` | Yes | string | Minimum 10 characters |
| `applyTo` | Yes | string | Valid glob pattern |
| `waf` | No | string[] | Must be valid WAF pillar names |

### 2. Choose your applyTo glob pattern

`applyTo` decides which files trigger the instruction; Copilot checks the active file against it.

**Pattern reference:**

| Pattern | Matches | Use Case |
|---------|---------|---------|
| `**/*.py` | All Python files | Python coding standards |
| `**/*.{ts,tsx}` | TypeScript + TSX | React/TypeScript standards |
| `**/*.bicep` | All Bicep files | IaC best practices |
| `**/*.{yaml,yml}` | YAML files | Config/pipeline standards |
| `**/test_*.py` | Python test files | Testing patterns |
| `**/tests/**` | All test directories | Test conventions |
| `solution-plays/**` | All play files | Play-specific rules |
| `solution-plays/01-*/**` | Play 01 files only | Per-play targeting |
| `**/*.{ts,js,py}` | Multi-language | Full-stack standards |
| `**/infra/**/*.bicep` | Infra Bicep only | Infrastructure rules |
| `hooks/**/*.{js,sh}` | Hook scripts | Hook implementation rules |
| `mcp-server/**/*.ts` | MCP server TypeScript | Server development rules |

**Glob rules:**
- `*` matches any characters except `/`
- `**` matches any characters including `/` (recursive)
- `{a,b}` matches either `a` or `b`
- `?` matches exactly one character

### 3. Use the scaffolder

```bash
node scripts/scaffold-primitive.js instruction
```

Prompts:
- **Name:** `my-domain-waf` (kebab-case, no `.instructions.md` suffix)
- **Description:** "Coding standards for [domain]" (minimum 10 characters)
- **applyTo:** `**/*.py` (glob pattern from the table above)

This creates `instructions/my-domain-waf.instructions.md` with starter frontmatter.

### 4. Write the instruction body

Use **specific, actionable rules** plus **code examples**; Copilot learns better from examples than abstract prose.

**Complete example — `instructions/python-azure-waf.instructions.md`:**

```markdown
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

- Use `DefaultAzureCredential` for all Azure authentication — never hardcode keys:
  ```python
  from azure.identity import DefaultAzureCredential
  credential = DefaultAzureCredential()
  client = AzureOpenAI(azure_ad_token_provider=credential)
  ```
- Load secrets from environment variables or Azure Key Vault, never from code:
  ```python
  endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]  # correct
  # endpoint = "https://my-instance.openai.azure.com"  # WRONG
  ```
- Validate all user input at API boundaries using Pydantic models
- Never log tokens, API keys, or connection strings — even at DEBUG level
- Use parameterized queries for any database access

## Reliability

- Add retry with exponential backoff on all Azure SDK and HTTP calls:
  ```python
  from tenacity import retry, stop_after_attempt, wait_exponential

  @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
  async def call_openai(prompt: str) -> str:
      return await client.chat.completions.create(...)
  ```
- Set explicit timeouts — never rely on client defaults:
  ```python
  async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
      response = await client.get(url)
  ```
- Implement health check endpoints returning 200 with dependency status
- Handle partial failures: degrade gracefully, don't crash the entire service

## Cost Optimization

- Always set `max_tokens` on LLM calls to prevent token budget overruns:
  ```python
  response = await client.chat.completions.create(
      model="gpt-4o",
      messages=messages,
      max_tokens=2048,  # explicit cap
      temperature=0.3
  )
  ```
- Route by complexity: GPT-4o-mini for classification/routing, GPT-4o for generation
- Cache embeddings — never recompute for identical content
- Set Azure resource SKUs explicitly, never rely on defaults

## Error Handling

- Catch specific exceptions — never bare `except:`:
  ```python
  except openai.RateLimitError:
      # back off and retry
  except openai.AuthenticationError:
      # log and alert, don't retry
  ```
- Log structured JSON with correlation IDs for distributed tracing
- Return meaningful error responses — no stack traces in production
```

### 5. WAF pillar reference

Valid `waf` values:

| Pillar | Value | Key Patterns |
|--------|-------|--------------|
| Security | `security` | Auth, secrets management, RBAC, input validation |
| Reliability | `reliability` | Retry, circuit breaker, health checks, graceful degradation |
| Cost Optimization | `cost-optimization` | Token budgets, model routing, SKU right-sizing |
| Operational Excellence | `operational-excellence` | Structured logging, CI/CD, IaC, monitoring |
| Performance Efficiency | `performance-efficiency` | Caching, async, streaming, connection pooling |
| Responsible AI | `responsible-ai` | Content safety, bias detection, transparency, grounding |

### 6. Advanced: Multi-scope instructions

Use one glob for multiple file types:

```yaml
---
description: "Full-stack WAF standards for TypeScript frontend and Python backend services"
applyTo: "**/*.{ts,tsx,py}"
waf:
  - "security"
  - "reliability"
  - "performance-efficiency"
---
```

For play-specific instructions inside a solution play:

```yaml
---
description: "Play 01 Enterprise RAG implementation standards"
applyTo: "solution-plays/01-enterprise-rag/**/*.{py,ts,bicep}"
waf:
  - "security"
  - "reliability"
  - "cost-optimization"
  - "responsible-ai"
---
```

### 7. Test in VS Code

1. Open a file matching `applyTo` (e.g., any `.py` file)
2. Start Copilot Chat and ask it to write code in that file
3. Verify suggestions follow the rules
4. Check with `@workspace` — ask "What instructions apply to this file?"

**Tip:** If inactive, check:
- The file matches the glob exactly
- Frontmatter YAML has no syntax errors (colons followed by spaces)
- The description is at least 10 characters

### 8. Validate

```bash
# Run the primitive validator
npm run validate:primitives

# Verify frontmatter parses correctly
node -e "
const fs = require('fs');
const content = fs.readFileSync('instructions/python-azure-waf.instructions.md', 'utf8');
const parts = content.split('---');
if (parts.length < 3) { console.log('❌ Missing frontmatter delimiters'); process.exit(1); }
const fm = parts[1].trim();
const hasDesc = fm.includes('description:');
const hasApply = fm.includes('applyTo:');
console.log('description:', hasDesc ? '✅' : '❌');
console.log('applyTo:', hasApply ? '✅' : '❌');
console.log(hasDesc && hasApply ? '✅ Instruction valid' : '❌ Missing required fields');
"
```

### 9. Publish to the ecosystem

Wire the instruction into a plugin so others can install it:

```json
{
  "name": "python-azure-waf",
  "description": "Python WAF coding standards for Azure AI services",
  "version": "1.0.0",
  "author": { "name": "FrootAI" },
  "license": "MIT",
  "instructions": ["../../instructions/python-azure-waf.instructions.md"],
  "agents": [],
  "skills": []
}
```

Then regenerate the marketplace:

```bash
npm run generate:marketplace
```

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Instruction not applied | Glob doesn't match file | Test pattern: `node -e "console.log(require('minimatch')('src/app.py', '**/*.py'))"` |
| Validator says "description too short" | Under 10 characters | Expand description to be more specific |
| YAML parse error in frontmatter | Missing space after colon | `description:"text"` → `description: "text"` |
| Instruction conflicts with another | Two instructions with overlapping globs | Make `applyTo` more specific or merge the instructions |
| Copilot ignores rules | Rules too vague | Add concrete code examples — Copilot follows examples better than prose |
| `waf` validation fails | Invalid pillar name | Use exact values: `security`, `reliability`, `cost-optimization`, `operational-excellence`, `performance-efficiency`, `responsible-ai` |

## Best Practices

1. **One concern per instruction** — don't mix Python and Bicep rules in one file
2. **Be specific** — "Use `DefaultAzureCredential`" beats "use managed identity"
3. **Include code examples** — Copilot follows examples in the instruction body
4. **Keep under 200 lines** — instructions are loaded into LLM context, brevity matters
5. **Use WAF tags** — they enable filtering, validation, and ecosystem search
6. **Test the glob** — open a matching file in VS Code and verify Copilot references your rules
7. **Prefer narrow globs** — `solution-plays/01-*/**/*.py` is better than `**/*.py` for play-specific rules
8. **Update, don't duplicate** — if a similar instruction exists, extend it rather than creating a new one
