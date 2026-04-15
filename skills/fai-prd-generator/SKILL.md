---
name: fai-prd-generator
description: |
  Generate Product Requirements Documents with user stories, acceptance
  criteria, technical constraints, and success metrics. Use when defining
  product features or preparing specs for engineering handoff.
---

# PRD Generator

Create structured PRDs with user stories, acceptance criteria, and success metrics.

## When to Use

- Defining a new product feature or capability
- Preparing specifications for engineering handoff
- Creating user stories with testable acceptance criteria
- Aligning stakeholders on scope, constraints, and success

---

## PRD Template

```markdown
# PRD: [Feature Name]

## Overview
**Author:** [name] | **Date:** [date] | **Status:** Draft/Review/Approved

## Problem Statement
[What problem does this solve? Who has this problem? How big is it?]

## Proposed Solution
[High-level description of what we're building]

## User Stories

### US-1: [As a {role}, I want {action}, so that {benefit}]
**Acceptance Criteria:**
- [ ] Given [context], when [action], then [result]
- [ ] Given [edge case], when [action], then [graceful handling]
- [ ] Performance: [specific metric target]

### US-2: [As a {role}, I want {action}, so that {benefit}]
**Acceptance Criteria:**
- [ ] [Criteria 1]
- [ ] [Criteria 2]

## Technical Constraints
- Must use [technology/service]
- Must integrate with [existing system]
- Must handle [scale requirement]
- Must comply with [regulation]

## Non-Goals (Out of Scope)
- [Explicitly excluded feature 1]
- [Explicitly excluded feature 2]

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| [Adoption] | [X users in Y days] | [Dashboard/Analytics] |
| [Performance] | [P95 < Xms] | [APM tool] |
| [Quality] | [X% satisfaction] | [NPS survey] |

## Dependencies
- [Team/System 1]: [What we need from them]
- [Team/System 2]: [What we need from them]

## Timeline
| Phase | Scope | Target Date |
|-------|-------|-------------|
| MVP | [US-1, US-2] | [Date] |
| V1 | [+ US-3, US-4] | [Date] |

## Open Questions
- [ ] [Decision needed on X]
- [ ] [Pending input from Y team]
```

## Auto-Generation

```python
def generate_prd(feature_description: str) -> str:
    return llm(f"""Generate a PRD for this feature. Include:
- Problem statement
- 3-5 user stories with Given/When/Then acceptance criteria
- Technical constraints
- Non-goals
- Success metrics with measurable targets
- Dependencies
- Timeline with MVP and V1 phases

Feature: {feature_description}""")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| PRD too vague | No acceptance criteria | Add Given/When/Then per story |
| Scope creep | No non-goals section | Explicitly list what's excluded |
| No alignment | Missing success metrics | Add measurable targets |
| Too long | Including design details | Keep PRD to WHAT, not HOW |
