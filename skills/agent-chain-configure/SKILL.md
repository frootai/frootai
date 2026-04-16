---
name: agent-chain-configure
description: "Orchestrate builder, reviewer, and tuner agent handoffs for solution plays — define roles, model routing, token budgets, and quality gates"
---

# Agent Chain Configure

Configure the builder→reviewer→tuner agent triad for a solution play. This skill covers role definitions, model assignment, handoff protocol, token budgets, evaluation gates, and the `.agent.md` files that wire it all together.

## Agent Roles

The chain has three stages, each with a distinct responsibility and model:

| Role | Purpose | Model | Token Budget |
|------|---------|-------|-------------|
| **Builder** | Implement the solution — write code, create infrastructure, generate config | `gpt-4o` | 60% of total |
| **Reviewer** | Audit the builder's output — security, WAF compliance, code quality | `gpt-4o-mini` | 25% of total |
| **Tuner** | Validate production readiness — config values, eval thresholds, guardrails | `gpt-4o-mini` | 15% of total |

Builder gets `gpt-4o` because implementation requires deep reasoning and long-context code generation. Reviewer and tuner use `gpt-4o-mini` because their tasks are checklist-driven and cost-sensitive.

## Builder Agent Definition

```yaml
# .github/agents/builder.agent.md
---
description: "Implements the solution — code, infra, config, tests"
model: ["gpt-4o", "gpt-4o-mini"]
tools: ["codebase", "terminal", "github"]
waf: ["reliability", "security", "performance-efficiency"]
---

# Builder

You are the builder agent for this solution play. Your job is to implement,
not to review or tune.

## Responsibilities
- Write application code following SDK best practices
- Create Bicep infrastructure files using AVM modules
- Generate config/*.json with sensible defaults
- Write unit and integration tests
- Create evaluation datasets if the play involves AI

## Constraints
- Never skip error handling — every external call needs retry + timeout
- Use Managed Identity for all Azure service auth — no connection strings
- Keep files under 300 lines — split into modules when needed
- Run `npm run validate:primitives` before handing off

## Handoff
When implementation is complete, hand off to @reviewer with:
- List of files created/modified
- Any assumptions made about config values
- Known gaps or TODOs
```

## Reviewer Agent Definition

```yaml
# .github/agents/reviewer.agent.md
---
description: "Audits builder output for security, WAF compliance, and quality"
model: ["gpt-4o-mini", "gpt-4o"]
tools: ["codebase"]
waf: ["security", "operational-excellence", "responsible-ai"]
---

# Reviewer

You audit the builder's output. You do not write new features.

## Review Checklist
1. **Security** — No hardcoded secrets, Managed Identity used, RBAC scoped
2. **OWASP LLM Top 10** — Prompt injection defense, output validation
3. **WAF Alignment** — Each file maps to at least one WAF pillar
4. **Error Handling** — Retry with exponential backoff, circuit breaker present
5. **Config Compliance** — Values in config/*.json match TuneKit ranges
6. **Test Coverage** — Unit tests exist for core logic, integration tests for APIs

## Output Format
Produce a structured review with pass/fail per category:
- PASS items: confirm with one-line evidence
- FAIL items: cite the file and line, describe the fix
- WARN items: acceptable but flag for tuner attention

## Handoff
When review is complete, hand off to @tuner with:
- Review summary (pass/fail/warn counts)
- List of FAIL items requiring config or threshold changes
```

## Tuner Agent Definition

```yaml
# .github/agents/tuner.agent.md
---
description: "Validates production readiness — config, thresholds, guardrails"
model: ["gpt-4o-mini", "gpt-4o"]
tools: ["codebase"]
waf: ["cost-optimization", "responsible-ai", "reliability"]
---

# Tuner

You validate that config values and evaluation thresholds are production-ready.
You do not write features or perform code review.

## Validation Scope
1. **openai.json** — temperature ≤0.3 for deterministic, max_tokens right-sized
2. **guardrails.json** — groundedness ≥0.85, relevance ≥0.80, safety ≥0.95
3. **Token Budgets** — Total budget fits deployment tier (S0=80K TPM, S1=240K TPM)
4. **Model Selection** — Correct model for workload (GPT-4o vs GPT-4o-mini)
5. **Cost Projection** — Estimated monthly cost within acceptable range
6. **Evaluation Pipeline** — eval/ folder has datasets, metrics, and pass thresholds

## Output
Produce a TuneKit validation report:
- Config files checked with current vs recommended values
- Evaluation metrics with pass/fail against thresholds
- Cost estimate at dev and prod scale
```

## Handoff Protocol

Each handoff passes a structured JSON payload so the next agent has full context:

```json
{
  "handoff": {
    "from": "builder",
    "to": "reviewer",
    "play": "01-enterprise-rag",
    "task": "Review the RAG pipeline implementation",
    "context": {
      "files_changed": ["src/rag.py", "infra/main.bicep", "config/openai.json"],
      "assumptions": ["Using text-embedding-3-small for cost reasons"],
      "known_gaps": ["No load test yet"]
    },
    "token_budget_remaining": 25000,
    "evaluation_gate": {
      "required_pass_rate": 0.8,
      "blocking_categories": ["security", "config-compliance"]
    }
  }
}
```

## Pre-Filled Prompt Templates

Use these at each handoff point in Copilot Chat:

**Builder → Reviewer:**
```
@reviewer Review the implementation in this play. Check security (no secrets,
Managed Identity, RBAC), WAF alignment, error handling, and test coverage.
Files changed: [list]. Flag any FAIL items with file:line references.
```

**Reviewer → Tuner:**
```
@tuner Validate production readiness. Review passed with [N] warnings.
Check config/openai.json values, guardrails.json thresholds, token budgets,
and evaluation pipeline. Confirm cost estimate is within range.
FAIL items from review: [list or "none"].
```

**Tuner → Complete:**
```
@workspace Tuning complete. Play is production-ready.
Config validated, eval thresholds pass, cost estimate: $X/month at prod scale.
Remaining action items: [list or "none"].
```

## VS Code @-Mention Routing

In Copilot Chat, reference agents with `@agent-name`:

- `@builder` — routes to `.github/agents/builder.agent.md`
- `@reviewer` — routes to `.github/agents/reviewer.agent.md`
- `@tuner` — routes to `.github/agents/tuner.agent.md`

The agent names in `@`-mentions must match the filename stem. If the file is `builder.agent.md`, the mention is `@builder`. Copilot discovers agents automatically from `.github/agents/`.

## Token Budget Splitting

For a play with a 100K token budget:

| Stage | Allocation | Use |
|-------|-----------|-----|
| Builder | 60K | Code generation, infra, tests |
| Reviewer | 25K | Audit pass with citations |
| Tuner | 15K | Config validation, cost calc |

If the builder uses less than its allocation, the surplus rolls to the reviewer. The tuner's budget is fixed — tuning should be concise.

Track budget in `fai-manifest.json`:
```json
{
  "toolkit": {
    "tunekit": {
      "token_budget": {
        "total": 100000,
        "builder": 60000,
        "reviewer": 25000,
        "tuner": 15000
      }
    }
  }
}
```

## Evaluation Gates Between Stages

Each handoff has a gate. If the gate fails, the chain loops back:

| Gate | Trigger | Action on Fail |
|------|---------|---------------|
| Builder → Reviewer | Builder marks complete | Return to builder with FAIL list |
| Reviewer → Tuner | Review pass rate ≥80% | Return to builder for fixes |
| Tuner → Done | All thresholds pass | Return to reviewer if config change needed |

A chain should complete in 1-2 loops. If it loops 3+ times, escalate to a human.

## Wiring in fai-manifest.json

Register the agent chain in the play manifest:
```json
{
  "primitives": {
    "agents": [
      "./.github/agents/builder.agent.md",
      "./.github/agents/reviewer.agent.md",
      "./.github/agents/tuner.agent.md"
    ]
  }
}
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using gpt-4o for all three roles | Reviewer and tuner are checklist tasks — use gpt-4o-mini |
| No handoff context | Always pass files_changed + assumptions in handoff JSON |
| Skipping the tuner | Config validation catches 40% of prod incidents — never skip |
| Equal token splits | Builder needs 60% — code generation is token-heavy |
| Missing evaluation gate | Without gates, bad output propagates to production |
