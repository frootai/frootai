---
name: fai-suggest-instructions
description: |
  Recommend instruction files from the FrootAI catalog based on project
  context, technology stack, and WAF requirements. Use when helping users
  configure Copilot instructions for their repository.
---

# Instruction Recommendation

Suggest .instructions.md files based on project context and stack.

## When to Use

- Setting up .github/instructions/ for a new repository
- Matching WAF pillars to instruction files
- Recommending instructions for specific frameworks
- Configuring applyTo globs for targeted activation

---

## Instruction Categories

| Category | Examples | ApplyTo Pattern |
|----------|---------|----------------|
| WAF Pillars | waf-reliability, waf-security | `**/*.{ts,py,bicep}` |
| Languages | python-waf, csharp-waf | `**/*.py`, `**/*.cs` |
| Frameworks | fastapi-*, aspnet-* | `**/api/**` |
| IaC | bicep-*, terraform-* | `**/*.bicep`, `**/*.tf` |
| AI | rag-*, prompt-*, eval-* | `**/*.py` |

## Recommendation Process

```python
INSTRUCTION_MAP = {
    "python": ["python-waf.instructions.md"],
    "typescript": ["typescript-waf.instructions.md"],
    "csharp": ["csharp-waf.instructions.md"],
    "bicep": ["bicep-best-practices.instructions.md"],
    "fastapi": ["fastapi-patterns.instructions.md"],
    "security": ["waf-security.instructions.md"],
    "reliability": ["waf-reliability.instructions.md"],
    "cost": ["waf-cost-optimization.instructions.md"],
}

def suggest_instructions(stack: list[str]) -> list[dict]:
    suggestions = []
    for tech in stack:
        for key, files in INSTRUCTION_MAP.items():
            if key in tech.lower():
                for f in files:
                    suggestions.append({"file": f, "reason": f"Matches {tech}"})
    # Always include WAF security
    suggestions.append({"file": "waf-security.instructions.md", "reason": "Required for all projects"})
    return suggestions
```

## Setup in Repository

```yaml
# .github/instructions/waf-security.instructions.md
---
description: Security patterns for AI applications
applyTo: "**/*.{ts,js,py,bicep,json,yaml,yml}"
---
[instruction content]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Instructions not activating | Wrong applyTo glob | Check glob matches file extensions |
| Too many instructions loaded | Broad globs | Narrow applyTo to relevant paths |
| Conflicting guidance | Multiple overlapping | Deduplicate, set priority order |
| Instructions outdated | No review cadence | Review quarterly with stack changes |

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
