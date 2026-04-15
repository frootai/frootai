---
name: fai-suggest-agents
description: |
  Recommend AI agents from the FrootAI catalog based on task requirements,
  technology stack, and solution play context. Use when helping users discover
  the right agent for their use case.
---

# Agent Recommendation

Suggest agents from the FrootAI catalog based on task and context.

## When to Use

- User asks "which agent should I use for X?"
- Matching task requirements to agent capabilities
- Recommending agents for a specific solution play
- Building agent compositions for multi-step workflows

---

## Agent Discovery Process

1. **Identify the task** — What does the user want to accomplish?
2. **Match domain** — RAG, security, infra, DevOps, testing?
3. **Check play context** — Is this part of a solution play?
4. **Recommend** — Suggest 1-3 agents with rationale

## Agent Categories

| Domain | Example Agents | Use For |
|--------|---------------|---------|
| RAG & Search | fai-rag-architect, fai-embedding-expert | Building retrieval pipelines |
| Security | fai-security-reviewer, fai-red-team-expert | Security audits, pen testing |
| Infrastructure | fai-architect, fai-landing-zone | Azure architecture, IaC |
| Multi-Agent | fai-autogen-expert, fai-swarm-supervisor | Agent orchestration |
| DevOps | fai-devops-expert, fai-github-actions-expert | CI/CD, deployment |
| Testing | fai-test-generator, fai-code-reviewer | Test generation, PR review |
| Cost | fai-cost-optimizer, fai-capacity-planner | FinOps, right-sizing |

## Recommendation Logic

```python
AGENT_MAP = {
    "rag": ["fai-rag-architect", "fai-embedding-expert"],
    "security": ["fai-security-reviewer", "fai-content-safety-expert"],
    "infrastructure": ["fai-architect", "fai-azure-openai-expert"],
    "testing": ["fai-test-generator", "fai-code-reviewer"],
    "deployment": ["fai-devops-expert", "fai-github-actions-expert"],
    "cost": ["fai-cost-optimizer"],
}

def suggest_agents(task_description: str) -> list[str]:
    keywords = task_description.lower()
    suggestions = []
    for domain, agents in AGENT_MAP.items():
        if domain in keywords or any(a.replace("fai-","").replace("-"," ") in keywords for a in agents):
            suggestions.extend(agents)
    return suggestions[:3] or ["fai-architect"]  # Default fallback
```

## Play-Specific Agents

Each solution play has a builder/reviewer/tuner triad:
- `fai-play-{NN}-builder` — Implements the solution
- `fai-play-{NN}-reviewer` — Reviews for quality and security
- `fai-play-{NN}-tuner` — Validates config and thresholds

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Wrong agent suggested | Task description too vague | Ask for specific domain/technology |
| No matching agent | Task outside FAI catalog | Suggest fai-architect as generalist |
| Multiple agents needed | Multi-step workflow | Recommend builder→reviewer→tuner chain |

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
