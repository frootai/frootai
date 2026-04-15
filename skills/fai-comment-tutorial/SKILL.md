---
name: fai-comment-tutorial
description: |
  Generate teaching-oriented code comments and walkthroughs that explain why,
  not just what. Use when onboarding developers, creating learning materials,
  or documenting complex algorithms without cluttering production code.
---

# Code Comment & Tutorial Generator

Generate educational comments and code walkthroughs for onboarding and learning.

## When to Use

- Onboarding new developers to a complex codebase
- Creating step-by-step tutorials from working code
- Documenting complex algorithms or business logic
- Building learning materials from production code

---

## Comment Quality Rules

| Do | Don't |
|----|-------|
| Explain WHY a decision was made | Restate what the code does |
| Document non-obvious constraints | Comment every line |
| Link to relevant docs/ADRs | Write essays in comments |
| Mark TODOs with owner and date | Leave orphan TODOs |

## Tutorial Generation

```python
def generate_tutorial(code: str, audience: str = "junior developer") -> str:
    return llm(f"""Create a step-by-step tutorial for this code.
Audience: {audience}
Rules:
- Explain each section's PURPOSE, not just what it does
- Highlight error handling and edge cases
- Note any non-obvious design decisions
- Keep explanations concise (1-2 sentences each)

Code:
{code}""")
```

## Inline Comment Pattern

```python
# BAD: restates the code
x = x + 1  # increment x by 1

# GOOD: explains why
x = x + 1  # Compensate for 0-based indexing in the API response

# BAD: obvious from types
def get_user(id: str) -> User:  # gets a user by id

# GOOD: documents constraint
def get_user(id: str) -> User:
    # Returns cached user if <5min old, otherwise fetches from DB.
    # Cache prevents N+1 queries in the conversation history loader.
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Comments too verbose | Explaining obvious code | Focus on WHY, not WHAT |
| Comments get stale | Not updated with code | Review comments in PR checklist |
| Tutorial too long | Covering every detail | Focus on happy path, link to reference for edge cases |

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

- `fai-readme-generator` — Project documentation
- `fai-api-docs-generator` — API reference documentation
- `fai-component-docs` — UI component documentation

## Definition of Done

Comments and tutorials are complete when they explain WHY (not WHAT), link to relevant docs, and can be understood by a developer who hasn't seen the code before.
