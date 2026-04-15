---
name: fai-plan-breakdown
description: |
  Break project plans into actionable tasks with sizing, dependencies,
  risk assessment, and sprint mapping. Use when decomposing PRDs, epics,
  or high-level requirements into executable work items.
---

# Plan Breakdown

Decompose plans into sized, ordered, dependency-tracked tasks.

## When to Use

- Breaking PRDs into sprint-ready tasks
- Decomposing technical epics into implementable slices
- Creating work breakdown structures for estimation
- Mapping tasks to sprints with dependency awareness

---

## Breakdown Process

```
PRD/Epic → Capabilities → Tasks → Sized → Ordered → Sprint-mapped
```

## Task Template

```markdown
### Task: [Clear, action-oriented title]

**Size:** S (1-2h) | M (half-day) | L (1 day) | XL (2-3 days)
**Depends on:** [Task ID or "None"]
**Sprint:** [Sprint number]
**Acceptance criteria:**
- [ ] [Measurable criterion 1]
- [ ] [Measurable criterion 2]
```

## Example Breakdown

```markdown
## Epic: Add Hybrid Search to RAG Pipeline

### T1: Set up AI Search index schema [M]
- Depends: None | Sprint: 1
- AC: Index created with vector + keyword fields

### T2: Implement embedding generation [M]
- Depends: T1 | Sprint: 1
- AC: Documents chunked and embedded, stored in index

### T3: Build hybrid search endpoint [L]
- Depends: T2 | Sprint: 1
- AC: API returns ranked results with keyword + vector scores

### T4: Add semantic reranking [S]
- Depends: T3 | Sprint: 2
- AC: Results reranked with semantic config enabled

### T5: Write integration tests [M]
- Depends: T3 | Sprint: 2
- AC: Tests cover happy path + empty results + error cases

### T6: Performance benchmark [M]
- Depends: T4 | Sprint: 2
- AC: P95 latency documented, meets <500ms target
```

## Sizing Guide

| Size | Hours | Use When |
|------|-------|----------|
| S | 1-2h | Config change, small fix, add test |
| M | 4h | New endpoint, module, or integration |
| L | 8h | Major feature component |
| XL | 16-24h | Full feature with tests — consider splitting |

## Auto-Generation

```python
def breakdown_plan(spec: str) -> str:
    return llm(f"""Break this specification into implementation tasks.
For each task: title, size (S/M/L/XL), dependencies, sprint, acceptance criteria.
Order by dependency then priority (risky/blocking first).
Use markdown format with checkboxes for acceptance criteria.

Spec:
{spec}""")
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Tasks too large (XL) | Not decomposed enough | Split XL into 2-3 M tasks |
| Missing dependencies | Linear thinking | Draw dependency graph first |
| Scope creep | No acceptance criteria | Add measurable AC to every task |
| Estimation off | Comparing unlike tasks | Use relative sizing (S/M/L), not hours |
