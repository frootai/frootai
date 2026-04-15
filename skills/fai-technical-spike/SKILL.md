---
name: fai-technical-spike
description: |
  Run timeboxed technical spikes to de-risk unknowns with structured experiments,
  decision criteria, and actionable conclusions. Use when evaluating technologies,
  patterns, or approaches before committing to implementation.
---

# Technical Spike

Run timeboxed experiments to de-risk technical decisions.

## When to Use

- Evaluating a new technology or library
- Testing if an approach is feasible before committing
- Comparing two technical solutions head-to-head
- De-risking unknowns in a sprint planning session

---

## Spike Template

```markdown
# Technical Spike: [Title]

**Time box:** [1-3 days]
**Owner:** [name]
**Goal:** [What question are we answering?]

## Hypothesis
[What do we expect to find?]

## Experiment
[What will we build/test to validate?]

## Decision Criteria
| Criterion | Target | Actual |
|-----------|--------|--------|
| Latency | < 500ms | — |
| Integration effort | < 2 days | — |
| Quality | >= 80% accuracy | — |

## Findings
[What did we discover?]

## Recommendation
[Go / No-Go / More research needed]

## Artifacts
- [Link to prototype code]
- [Link to benchmark results]
```

## Spike Types

| Type | Duration | Output |
|------|----------|--------|
| Feasibility | 1 day | Can we do X? Yes/No + evidence |
| Comparison | 2 days | A vs B with benchmark data |
| Integration | 2-3 days | Working prototype + rough edges list |
| Performance | 1-2 days | Benchmark results + bottleneck analysis |

## Best Practices

| Practice | Why |
|----------|-----|
| Strict timebox | Prevents perfectionism — spike explores, doesn't build |
| Written conclusion | Forces clear decision, prevents "let me keep exploring" |
| Throwaway code is OK | Spike code is learning, not production |
| Share findings | Spike value is in the knowledge, not the code |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Spike runs over timebox | Scope too broad | Narrow to one specific question |
| No clear conclusion | No decision criteria upfront | Define criteria BEFORE starting |
| Spike code goes to prod | No separation | Use separate branch, delete after |
| Team doesn't learn from spike | No writeup | Require written findings + demo |

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
