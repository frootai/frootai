---
name: fai-skill-template
description: |
  Create SKILL.md files following the Agent Skills specification with proper
  frontmatter, structured content, and progressive disclosure. Use when
  authoring new skills for VS Code Copilot, Claude, or other agent platforms.
---

# Skill Template

Author SKILL.md files following the Agent Skills specification.

## When to Use

- Creating a new skill for VS Code Copilot
- Following the agentskills.io specification
- Ensuring skill metadata enables proper agent matching
- Structuring content for progressive disclosure

---

## Specification Requirements

| Field | Required | Constraints |
|-------|----------|-------------|
| name | Yes | 1-64 chars, lowercase, hyphens, match folder |
| description | Yes | 1-1024 chars, WHAT + WHEN keywords |
| license | No | License name or file reference |
| compatibility | No | Environment requirements |
| metadata | No | Arbitrary key-value map |

## Template

```markdown
---
name: my-skill-name
description: |
  [Verb] [domain objects] with [techniques/tools]. Use this skill when:
  - [Scenario 1 that triggers this skill]
  - [Scenario 2]
  - [Scenario 3]
---

# [Skill Title]

[One-sentence summary of what the skill does.]

## When to Use

- [Specific trigger 1]
- [Specific trigger 2]
- [Specific trigger 3]

---

## [Pattern/Step/Section 1]

\`\`\`[language]
[Real, runnable code example]
\`\`\`

## [Pattern/Step/Section 2]

\`\`\`[language]
[Real, runnable code example]
\`\`\`

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| [Problem 1] | [Root cause] | [Solution] |
| [Problem 2] | [Root cause] | [Solution] |
```

## Quality Checklist

- [ ] Name matches folder name exactly
- [ ] Description is keyword-rich (WHAT + WHEN)
- [ ] Description is multi-line with `|` for trigger list
- [ ] Content has real code in correct language
- [ ] 100-300 lines (sweet spot for token budget)
- [ ] Troubleshooting table with domain-specific issues
- [ ] No generic boilerplate — every line adds value

## Description Quality Examples

```yaml
# Bad — too generic
description: "Helps with testing"

# Good — keyword-rich with triggers
description: |
  Write pytest tests with coverage reporting, parametrized cases, and
  async fixtures. Use when setting up Python test infrastructure or
  enforcing coverage thresholds in CI.
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Skill not discovered | Name doesn't match folder | Ensure name == folder name |
| Agent never invokes skill | Description too vague | Add specific trigger scenarios |
| Skill too expensive to load | Over 500 lines | Move detail to references/ folder |
| Code examples outdated | No review cadence | Review quarterly |
