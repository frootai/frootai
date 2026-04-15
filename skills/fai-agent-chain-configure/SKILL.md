---
name: fai-agent-chain-configure
description: 'Configure builder→reviewer→tuner agent chain with handoff rules, model assignment, and evaluation gates.'
---

# Agent Chain Configure

## Purpose

This skill defines a production-ready workflow for configuring the builder→reviewer→tuner agent triad for solution plays, including role definitions, model assignment, handoff protocols, token budgets, and evaluation gates. It enforces full six-phase coverage, WAF-aligned quality gates, and reproducible delivery outcomes.

## Inputs

| Input | Description |
|---|---|
| Play ID | Target solution play identifier (e.g., 01-enterprise-rag) |
| Token budget | Total token allocation for the chain (default 100K) |
| Model preferences | Model per role — builder: gpt-4o, reviewer/tuner: gpt-4o-mini |
| Evaluation thresholds | Pass rates and blocking categories per gate |

## Prerequisites

- Solution play repository initialized with `fai-manifest.json`.
- `.github/agents/` directory exists.
- Agent roles and responsibilities are agreed upon.
- Token budget is allocated and approved.

## Full Phases Coverage

### Phase 1: Discover

- Identify the solution play and its complexity tier.
- Determine token budget allocation per role (60/25/15 split).
- Review evaluation gate requirements from stakeholders.
- Confirm model availability (gpt-4o, gpt-4o-mini deployments).

### Phase 2: Design

- Define the three agent files:

```yaml
# .github/agents/builder.agent.md
---
description: "Implements the solution — code, infra, config, tests"
model: ["gpt-4o", "gpt-4o-mini"]
tools: ["codebase", "terminal", "github"]
waf: ["reliability", "security", "performance-efficiency"]
---
```

```yaml
# .github/agents/reviewer.agent.md
---
description: "Audits builder output for security, WAF compliance, and quality"
model: ["gpt-4o-mini", "gpt-4o"]
tools: ["codebase"]
waf: ["security", "operational-excellence", "responsible-ai"]
---
```

```yaml
# .github/agents/tuner.agent.md
---
description: "Validates production readiness — config, thresholds, guardrails"
model: ["gpt-4o-mini", "gpt-4o"]
tools: ["codebase"]
waf: ["cost-optimization", "responsible-ai", "reliability"]
---
```

- Design handoff protocol with structured JSON payload:

```json
{
  "handoff": {
    "from": "builder",
    "to": "reviewer",
    "play": "01-enterprise-rag",
    "files_changed": ["src/rag.py", "infra/main.bicep"],
    "assumptions": ["Using text-embedding-3-small"],
    "token_budget_remaining": 25000
  }
}
```

### Phase 3: Implement

- Create the three `.agent.md` files in `.github/agents/`.
- Wire agents in `fai-manifest.json`:

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

- Configure token budget tracking:

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

- Set up pre-filled handoff prompt templates for each transition.

### Phase 4: Validate

- Verify each agent file has required frontmatter (description, model, tools, waf).
- Confirm agent names in `@`-mentions match the filename stem.
- Test handoff protocol by running a sample chain and verifying context passes.
- Validate evaluation gates trigger loop-back when thresholds fail.

### Phase 5: Deploy

- Commit agent files and manifest to the play branch.
- Verify Copilot discovers all three agents via `@builder`, `@reviewer`, `@tuner`.
- Run one full chain cycle (build → review → tune) on dev environment.
- Confirm token budgets are tracked and surplus rolls forward correctly.

### Phase 6: Operate

- Monitor chain completion rates — escalate if 3+ loops occur.
- Track token usage per role to right-size budgets over time.
- Review handoff quality quarterly — are structured payloads complete?
- Feed chain failure patterns into agent prompt improvements.

## WAF-Aligned Quality Gates

### Reliability

- Retry, timeout, and fallback behavior are validated.
- Dependency health checks and alerting are active.
- Degraded operation paths are tested and documented.

### Security

- Secrets are externalized via Key Vault or Managed Identity.
- Least-privilege RBAC is enforced on all resources.
- Audit trails capture all critical operations.

### Cost Optimization

- Resource sizing is evidence-based and right-sized.
- Expensive operations are measured and optimized.
- Budget alerts are configured per resource group.

### Operational Excellence

- CI/CD pipelines validate before every deployment.
- Runbooks and rollback procedures are current and tested.
- Metrics and traces support rapid root-cause diagnosis.

### Performance Efficiency

- SLO targets are explicit, monitored, and alerted.
- Hot paths are benchmarked under realistic load.
- Operational overhead is minimized.

### Responsible AI

- Content safety filters are applied where AI is used.
- Model outputs are transparent and explainable to users.
- Human escalation exists for high-impact or ambiguous decisions.

## Deliverables

| Artifact | Purpose |
|---|---|
| Implementation artifacts | Code, config, and infrastructure files |
| Validation evidence | Test results, compliance checks, quality metrics |
| Rollback guide | Step-by-step reversal and mitigation procedures |
| Operate handoff | Monitoring setup, ownership, and escalation paths |

## Completion Checklist

- [ ] Phase 1 discovery documented with scope and success criteria.
- [ ] Phase 2 design approved with tradeoff rationale.
- [ ] Phase 3 implementation reviewed and merged.
- [ ] Phase 4 validation passed with evidence collected.
- [ ] Phase 5 staged rollout completed through all environments.
- [ ] Phase 6 operate handoff accepted by operations team.

## Troubleshooting

### Symptom: Deployment fails in staging but works in dev

- Compare environment configuration (feature flags, network rules, RBAC).
- Verify service principal permissions match between environments.
- Check for region-specific resource availability differences.

### Symptom: Quality metrics degrade after deployment

- Compare baseline metrics with post-deployment measurements.
- Check for configuration drift between environments.
- Roll back and isolate the change that caused degradation.

### Symptom: Monitoring gaps or missing telemetry

- Verify instrumentation is deployed to all service instances.
- Check sampling rates — increase temporarily for debugging.
- Confirm diagnostic settings route to the correct Log Analytics workspace.

## Definition of Done

The skill is complete when all six phases have objective evidence, quality gates pass, and another engineer can reproduce outcomes without tribal knowledge.

## Metadata

- Category: Infrastructure
- WAF Pillars: Reliability, Security, Operational Excellence
- Maintainer: FAI Skill System
- Review cadence: Quarterly and after major platform changes
