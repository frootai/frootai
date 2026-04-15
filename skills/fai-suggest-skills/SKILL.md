---
name: fai-suggest-skills
description: |
  Recommend skills from the FrootAI catalog based on user task, technology
  stack, and development phase. Use when helping users discover relevant
  skills for their workflow.
---

# Skill Recommendation

Suggest skills from the 322-skill catalog based on task and context.

## When to Use

- User asks "what skill should I use for X?"
- Matching development tasks to available skills
- Recommending skills for a specific technology stack
- Building skill combinations for workflows

---

## Skill Discovery by Task

| Task | Recommended Skills | Why |
|------|-------------------|-----|
| Build RAG pipeline | fai-build-genai-rag, fai-build-semantic-search | End-to-end RAG |
| Write tests | fai-pytest-coverage, fai-jest-test, fai-junit-test | Language-specific |
| Deploy to Azure | fai-deploy-01-enterprise-rag, fai-rollout-plan | Deployment patterns |
| Review code | fai-review-and-refactor, fai-security-review-skill | Quality + security |
| Build MCP server | fai-mcp-python-generator, fai-mcp-typescript-generator | Language-specific |
| Create docs | fai-readme-generator, fai-api-docs-generator | Documentation |
| Optimize cost | fai-az-cost-optimize, fai-cost-estimator | FinOps |
| Build prompts | fai-prompt-builder, fai-boost-prompt | Prompt engineering |

## Recommendation Logic

```python
def suggest_skills(task: str, stack: str = None, limit: int = 3) -> list[str]:
    """Recommend skills based on task description and optional stack."""
    # Keyword matching (simplified — production would use embeddings)
    TASK_SKILLS = {
        "test": ["fai-pytest-coverage", "fai-jest-test", "fai-build-integration-test"],
        "deploy": ["fai-rollout-plan", "fai-multi-stage-docker"],
        "rag": ["fai-build-genai-rag", "fai-build-semantic-search"],
        "mcp": ["fai-mcp-python-generator", "fai-mcp-typescript-generator"],
        "review": ["fai-review-and-refactor", "fai-security-review-skill"],
        "prompt": ["fai-prompt-builder", "fai-boost-prompt"],
    }

    matches = []
    for keyword, skills in TASK_SKILLS.items():
        if keyword in task.lower():
            matches.extend(skills)

    # Stack-specific filtering
    if stack:
        STACK_SKILLS = {
            "python": ["fai-pytest-coverage", "fai-fastapi-scaffold"],
            "dotnet": ["fai-mstest-test", "fai-aspnet-minimal-api"],
            "java": ["fai-junit-test", "fai-springboot-scaffold"],
        }
        matches.extend(STACK_SKILLS.get(stack.lower(), []))

    return list(dict.fromkeys(matches))[:limit]
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No match found | Task too vague | Ask for specific technology/domain |
| Wrong stack match | Stack not specified | Ask user for their language/framework |
| Too many suggestions | No limit | Cap at 3 most relevant |
| Skill doesn't exist | Catalog gap | Check skills/ directory, suggest nearest |

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
