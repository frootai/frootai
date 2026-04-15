---
name: fai-powerbi-modeling
description: |
  Design Power BI data models with star schemas, relationships, role-level
  security, and performance optimization. Use when building the data
  foundation for Power BI reports and dashboards.
---

# Power BI Data Modeling

Design optimized data models with star schemas, RLS, and performance tuning.

## When to Use

- Designing data models for new Power BI reports
- Optimizing existing models for performance
- Implementing row-level security
- Setting up incremental refresh

---

## Star Schema Pattern

```
            DimDate
              │
DimUser ─── FactUsage ─── DimModel
              │
            DimTeam
```

## Relationship Rules

| Rule | Why |
|------|-----|
| One-to-many only | Many-to-many causes ambiguity |
| Single direction by default | Cross-filter only when needed |
| Active relationship per table pair | Use USERELATIONSHIP for alternates |
| Always define cardinality | Prevents incorrect joins |

## Row-Level Security

```dax
// RLS filter for team data
[Team] = USERPRINCIPALNAME()

// Or with lookup table
LOOKUPVALUE(TeamMembers[Team],
    TeamMembers[Email], USERPRINCIPALNAME()) = FactUsage[Team]
```

```bash
# Test RLS in Power BI Desktop:
# Modeling → View as → Select role + user
```

## Performance Optimization

| Technique | Impact | How |
|-----------|--------|-----|
| Remove unused columns | High | Delete from model, not just hide |
| Use integers for keys | High | Replace text keys with integer surrogates |
| Disable auto date/time | Medium | File → Options → Data Load |
| Incremental refresh | High | Set range policy on fact table |
| Aggregations | Very High | Pre-aggregate at grain level |

## Incremental Refresh

```
// Parameters (must be named exactly):
RangeStart = #datetime(2024, 1, 1, 0, 0, 0)
RangeEnd = #datetime(2026, 12, 31, 0, 0, 0)

// Filter in Power Query:
Table.SelectRows(Source, each [Date] >= RangeStart and [Date] < RangeEnd)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow report | Large model in memory | Remove unused columns, aggregate |
| Wrong totals | Many-to-many relationship | Redesign to star schema |
| RLS not working | Filter not applied | Test with "View as" in Desktop |
| Refresh timeout | Full refresh too large | Enable incremental refresh |

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
