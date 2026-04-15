---
name: fai-power-bi-report
description: |
  Create Power BI reports with data modeling, relationship design, DAX
  calculations, and visual best practices. Use when building analytical
  reports for business intelligence.
---

# Power BI Report Design

Create analytical reports with proper modeling, DAX, and visual design.

## When to Use

- Building analytical reports from structured data
- Designing star schema data models
- Writing DAX measures for business metrics
- Following visual design best practices

---

## Star Schema Design

```
Fact Table: FactAIUsage
  → UserId (FK → DimUser)
  → ModelId (FK → DimModel)
  → DateKey (FK → DimDate)
  → PromptTokens
  → CompletionTokens
  → LatencyMs
  → QualityScore

DimUser: UserId, Name, Team, Role
DimModel: ModelId, ModelName, Provider, CostPerToken
DimDate: DateKey, Date, Month, Quarter, Year, IsWeekday
```

## DAX Patterns

```dax
// Time intelligence: Year-over-Year
YoY Growth % =
    VAR CurrentYear = [Total Queries]
    VAR PriorYear = CALCULATE([Total Queries], SAMEPERIODLASTYEAR(DimDate[Date]))
    RETURN DIVIDE(CurrentYear - PriorYear, PriorYear, 0)

// Running total
Running Total Cost =
    CALCULATE([Total Cost], FILTER(ALL(DimDate), DimDate[Date] <= MAX(DimDate[Date])))

// Dynamic ranking
Top N Models =
    VAR Rank = RANKX(ALL(DimModel[ModelName]), [Total Queries])
    RETURN IF(Rank <= 5, [Total Queries], BLANK())

// Conditional formatting measure
Cost Status =
    SWITCH(TRUE(),
        [Total Cost] > [Budget] * 0.9, "Critical",
        [Total Cost] > [Budget] * 0.75, "Warning",
        "Normal"
    )
```

## Visual Best Practices

| Principle | Rule |
|-----------|------|
| KPI tiles | Top of page, 4-6 max |
| Chart types | Line=trends, Bar=comparison, Pie=composition (limit to 5 slices) |
| Colors | Use semantic colors (green=good, red=alert) |
| Interactivity | Add slicers for date, model, team |
| Mobile | Design separate mobile layout |
| Accessibility | Alt text on all visuals, high contrast |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Measure returns blank | Filter context issue | Use CALCULATE with explicit filters |
| Slow visual rendering | Too many data points | Aggregate data, limit rows |
| Relationship error | Ambiguous path | Use USERELATIONSHIP in DAX |
| Report too cluttered | Too many visuals | Split into focused pages |

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
