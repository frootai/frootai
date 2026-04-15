---
name: fai-manifest-create
description: |
  Create fai-manifest.json files with context wiring, primitive references,
  infrastructure pointers, and guardrail thresholds. Use when initializing
  a new solution play or connecting primitives via the FAI Protocol.
---

# FAI Manifest Creator

Generate fai-manifest.json for solution play context wiring and primitive registration.

## When to Use

- Initializing a new solution play with FAI Protocol
- Wiring agents, skills, hooks, and instructions to a play
- Configuring guardrail thresholds for quality gates
- Connecting infrastructure and toolkit references

---

## Manifest Schema

```json
{
  "play": "01-enterprise-rag",
  "version": "1.0.0",
  "context": {
    "knowledge": ["./.github/copilot-instructions.md"],
    "waf": ["reliability", "security", "cost-optimization",
            "operational-excellence", "performance-efficiency", "responsible-ai"]
  },
  "primitives": {
    "agents": [
      "./.github/agents/builder.agent.md",
      "./.github/agents/reviewer.agent.md",
      "./.github/agents/tuner.agent.md"
    ],
    "instructions": ["./.github/instructions/*.instructions.md"],
    "skills": ["./.github/skills/*/SKILL.md"],
    "hooks": ["./.github/hooks/*/hooks.json"]
  },
  "infrastructure": {
    "provider": "azure",
    "entrypoint": "./infra/main.bicep",
    "parameters": "./infra/main.bicepparam"
  },
  "toolkit": {
    "devkit": { "scanner": true, "linter": true },
    "tunekit": {
      "token_budget": { "total": 100000, "builder": 60000, "reviewer": 25000, "tuner": 15000 }
    },
    "speckit": { "spec_path": "./spec/fai-manifest.json" }
  },
  "guardrails": {
    "groundedness": 0.85,
    "relevance": 0.80,
    "safety": 0.95,
    "latency_p95_ms": 3000
  }
}
```

## CLI Generation

```bash
# Initialize manifest for a new play
npx frootai init --play 01-enterprise-rag --output fai-manifest.json
```

## Validation

```bash
# Validate manifest against schema
node -e "const m = require('./fai-manifest.json'); console.log('play:', m.play, 'version:', m.version)"

# Check all referenced files exist
npx frootai validate --manifest fai-manifest.json
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Primitive not discovered | Path glob doesn't match | Check glob pattern matches actual file locations |
| Guardrail threshold too strict | Default values | Tune thresholds based on evaluation results |
| Missing WAF pillars | Incomplete context.waf | Include all 6 pillars |
| Infrastructure deploy fails | Wrong entrypoint path | Verify infra/main.bicep exists |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Start simple, add complexity when needed | Avoid over-engineering |
| Automate repetitive tasks | Consistency and speed |
| Document decisions and tradeoffs | Future reference for the team |
| Validate with real data | Don't rely on synthetic tests alone |
| Review with peers | Fresh eyes catch blind spots |
| Iterate based on feedback | First version is never perfect |

## Quality Checklist

- [ ] Requirements clearly defined
- [ ] Implementation follows project conventions
- [ ] Tests cover happy path and error paths
- [ ] Documentation updated
- [ ] Peer reviewed
- [ ] Validated in staging environment

## Related Skills

- `fai-implementation-plan-generator` — Planning and milestones
- `fai-review-and-refactor` — Code review patterns
- `fai-quality-playbook` — Engineering quality standards
