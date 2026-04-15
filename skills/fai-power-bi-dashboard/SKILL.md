---
name: fai-power-bi-dashboard
description: |
  Design Power BI operational dashboards with KPI tiles, trend charts,
  filter slicers, and refresh schedules. Use when building executive or
  operational dashboards for AI workload monitoring.
---

# Power BI Dashboard Design

Build operational dashboards with KPIs, trends, and interactive filtering.

## When to Use

- Building executive dashboards for AI workload metrics
- Creating operational views for token usage and costs
- Designing interactive reports with drill-through
- Setting up scheduled refresh for live data

---

## Dashboard Layout

```
┌─────────────────────────────────────────┐
│  KPI Tiles                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ MAU  │ │Queries│ │ Cost │ │ P95  │  │
│  │1,234 │ │45.2K │ │$1.2K │ │850ms │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │ Usage Trend      │ │ Cost by Model │ │
│  │ (line chart)     │ │ (pie chart)   │ │
│  └─────────────────┘ └───────────────┘ │
│                                         │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │ Top Queries      │ │ Error Rate    │ │
│  │ (table)          │ │ (area chart)  │ │
│  └─────────────────┘ └───────────────┘ │
│                                         │
│  Filters: [Date Range] [Model] [Team]  │
└─────────────────────────────────────────┘
```

## DAX Measures

```dax
Total Queries = COUNTROWS(AITelemetry)

Monthly Active Users = DISTINCTCOUNT(AITelemetry[UserId])

Average Latency =
    AVERAGE(AITelemetry[LatencyMs])

P95 Latency =
    PERCENTILE.INC(AITelemetry[LatencyMs], 0.95)

Total Cost =
    SUMX(AITelemetry,
        AITelemetry[PromptTokens] * RELATED(ModelPricing[InputRate])
        + AITelemetry[CompletionTokens] * RELATED(ModelPricing[OutputRate])
    ) / 1000000

MoM Growth =
    VAR CurrentMonth = [Total Queries]
    VAR PreviousMonth = CALCULATE([Total Queries], DATEADD(Calendar[Date], -1, MONTH))
    RETURN DIVIDE(CurrentMonth - PreviousMonth, PreviousMonth, 0)
```

## Data Model

| Table | Key Columns | Update |
|-------|------------|--------|
| AITelemetry | Timestamp, Model, Tokens, LatencyMs, UserId | Incremental |
| ModelPricing | Model, InputRate, OutputRate | Manual |
| Calendar | Date, Month, Quarter, Year | Generated |

## Refresh Schedule

| Dataset | Schedule | Mode |
|---------|----------|------|
| AITelemetry | Every 30 min | Incremental |
| ModelPricing | Weekly | Full |
| Calendar | Never | Calculated |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow dashboard | Too many visuals | Limit to 6-8 visuals per page |
| Refresh timeout | Large dataset | Use incremental refresh |
| Wrong KPI value | Filter context | Check measure with ALL/REMOVEFILTERS |
| Stale data | Refresh not scheduled | Configure gateway + schedule |

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
