---
description: "Power BI DAX standards — CALCULATE patterns, time intelligence, performance optimization."
applyTo: "**/*.dax, **/*.pbix"
waf:
  - "performance-efficiency"
  - "cost-optimization"
---

# Power BI & DAX — FAI Standards

## Star Schema Modeling

- One fact table per business process, dimension tables around it — no snowflaking unless >1M rows in a dimension
- Surrogate integer keys on every dimension; never join on natural/composite keys
- Date dimension required — mark as Date table, columns: `DateKey`, `Year`, `MonthNum`, `MonthName`, `Quarter`, `WeekNum`, `DayOfWeek`, `IsWeekday`, `FiscalYear`, `FiscalQuarter`
- Degenerate dimensions (order number, invoice ID) stay in the fact table, not a separate dim
- Bridge tables for many-to-many; set cross-filter direction to Single, use `CROSSFILTER` in DAX when needed

## Measures vs Calculated Columns

- **Measures** for anything that aggregates at query time — totals, averages, ratios, YTD
- **Calculated columns** only when the value is row-level, needed for slicing/filtering, and cannot be computed in Power Query
- Never create a calculated column that sums or counts — it wastes memory and produces wrong results when filtered
- Calculated tables only for disconnected parameter tables or `CALENDAR`/`CALENDARAUTO`

## CALCULATE and Filter Context

```dax
// CALCULATE transitions row context to filter context and applies filters
Sales in West =
    CALCULATE(
        [Total Sales],
        Region[Territory] = "West"
    )

// Remove existing filters with REMOVEFILTERS (replaces deprecated ALL in filter args)
All Product Sales =
    CALCULATE(
        [Total Sales],
        REMOVEFILTERS( Product )
    )

// Percentage of parent — keep outer filters, remove only one column
Category % =
    DIVIDE(
        [Total Sales],
        CALCULATE( [Total Sales], REMOVEFILTERS( Product[SubCategory] ) )
    )
```

- `CALCULATE` is the only function that changes filter context — understand it deeply before writing any measure
- Never nest `CALCULATE` inside `CALCULATE` without clear intent — flatten with variables instead
- Use `KEEPFILTERS` when adding filters that should intersect (not replace) existing context

## Iterator Functions vs Aggregators

```dax
// Aggregator — fast, single-pass, works on columns only
Total Sales = SUM( Sales[Amount] )

// Iterator — row-by-row, required for expressions across columns
Weighted Avg Price =
    DIVIDE(
        SUMX( Sales, Sales[Quantity] * Sales[UnitPrice] ),
        SUM( Sales[Quantity] )
    )
```

- Prefer `SUM`, `AVERAGE`, `MIN`, `MAX` over `SUMX`, `AVERAGEX` when operating on a single column
- Use iterators (`SUMX`, `AVERAGEX`, `COUNTX`, `MAXX`, `RANKX`) when the expression combines multiple columns
- `FILTER` inside iterators can be expensive — move conditions to `CALCULATE` filter args when possible

## Time Intelligence

```dax
// Year-over-year comparison
Sales YoY =
    VAR CurrentSales = [Total Sales]
    VAR PriorYear = CALCULATE( [Total Sales], SAMEPERIODLASTYEAR( 'Date'[Date] ) )
    RETURN
        DIVIDE( CurrentSales - PriorYear, PriorYear )

// Year-to-date
Sales YTD = CALCULATE( [Total Sales], DATESYTD( 'Date'[Date] ) )

// Rolling 3-month average
Rolling 3M Avg =
    CALCULATE(
        [Total Sales] / 3,
        DATESINPERIOD( 'Date'[Date], MAX( 'Date'[Date] ), -3, MONTH )
    )

// Shift period by N months
Sales Prev Quarter =
    CALCULATE( [Total Sales], DATEADD( 'Date'[Date], -1, QUARTER ) )
```

- Time intelligence requires a contiguous Date table marked as Date table with no gaps
- Always use `'Date'[Date]` (date column), never `Sales[OrderDate]`
- `TOTALYTD`/`TOTALQTD`/`TOTALMTD` are shortcuts for `CALCULATE` + `DATESYTD`/`DATESQTD`/`DATESMTD`

## Variables (VAR / RETURN)

```dax
// Variables evaluate ONCE, improve readability, and prevent recalculation
Profit Margin =
    VAR TotalRevenue = [Total Sales]
    VAR TotalCost = [Total Cost]
    VAR Margin = DIVIDE( TotalRevenue - TotalCost, TotalRevenue )
    RETURN
        Margin
```

- Use `VAR` liberally — every intermediate calculation gets a descriptive name
- Variables are evaluated in the filter context at the point of definition, not at `RETURN`
- Use variables to avoid repeating expensive sub-expressions (evaluated once, referenced many times)

## Division and Formatting

- Always `DIVIDE( numerator, denominator )` — never `a / b` (division by zero crashes visuals)
- `DIVIDE` returns `BLANK()` by default on zero; supply third arg for custom alternate: `DIVIDE( a, b, 0 )`
- `FORMAT` produces text — never use in measures consumed by other measures or conditional logic
- `FORMAT` only in display-only measures: `Format Sales = FORMAT( [Total Sales], "#,##0.00" )`

## Relationship Management

```dax
// Use inactive relationship on demand
Ship Date Sales =
    CALCULATE(
        [Total Sales],
        USERELATIONSHIP( Sales[ShipDateKey], 'Date'[DateKey] )
    )
```

- One active relationship per path between tables; additional relationships set to inactive
- `USERELATIONSHIP` activates an inactive relationship inside `CALCULATE` — it deactivates the active one on the same path
- Set cross-filter direction to **Single** by default; Bi-directional only with documented justification
- `TREATAS` for virtual relationships without model changes: `CALCULATE( [Total Sales], TREATAS( VALUES( Budget[ProductKey] ), Sales[ProductKey] ) )`

## Row-Level Security (RLS)

- Define roles in Tabular Editor or Power BI Desktop with DAX filter expressions on dimension tables
- `[Region] = USERPRINCIPALNAME()` — filter the security table, let star schema propagate
- Test every role with "View as Role" before publishing
- RLS on fact tables is expensive — always filter through dimensions
- Dynamic RLS via a security mapping table: `CONTAINS( SecurityTable, SecurityTable[UPN], USERPRINCIPALNAME(), SecurityTable[Region], Region[Territory] )`

## Storage and Refresh

- Import mode for datasets <1GB with full DAX support
- DirectQuery for real-time with >10GB source — accept limited DAX and slower performance
- Composite models: import dimensions + DirectQuery facts for balance of speed and freshness
- Incremental refresh: partition by date, set `RangeStart`/`RangeEnd` parameters in Power Query, configure rolling window
- Enable query caching on Premium/PPU workspaces for frequently accessed reports

## Tooling

- **DAX Studio**: profile queries with Server Timings (SE vs FE), find slow measures, test DAX interactively
- **Tabular Editor**: ALM toolkit — manage measures/partitions/perspectives/roles, script bulk changes in C#, save as folder for Git source control
- **Best Practice Analyzer (BPA)** in Tabular Editor: enable default rules + custom rules for naming conventions
- **Performance Analyzer** in Power BI Desktop: identify slow visuals, capture generated DAX queries

## Anti-Patterns

- ❌ `a / b` instead of `DIVIDE(a, b)` — crashes on zero denominators
- ❌ Calculated columns for aggregations — wrong results under filters + memory waste
- ❌ Bi-directional cross-filter without justification — ambiguous paths, performance degradation
- ❌ `FORMAT` in measures used in calculations — produces text, breaks math
- ❌ Time intelligence on a non-contiguous date table — silent wrong results
- ❌ RLS filters on fact tables — scans millions of rows instead of filtering dimensions
- ❌ Nested `CALCULATE` without `VAR` — unreadable and often produces unexpected filter context
- ❌ `DISTINCTCOUNT` inside iterators — use `SUMX` + `CALCULATE` + `COUNTROWS(VALUES(...))` pattern instead
- ❌ Measures without `VAR` that repeat the same sub-expression — doubles evaluation cost

## WAF Alignment

| Pillar | Power BI Practice |
|---|---|
| **Performance Efficiency** | Star schema, aggregations, composite models, `VAR` to avoid recalculation, import over DirectQuery when possible |
| **Cost Optimization** | Right-size Premium capacity, incremental refresh to reduce processing, shared datasets to avoid duplication |
| **Security** | Row-level security via dimension filters, `USERPRINCIPALNAME()`, workspace RBAC, sensitivity labels |
| **Reliability** | Incremental refresh partitions, deployment pipelines (Dev→Test→Prod), source control via Tabular Editor |
| **Operational Excellence** | DAX Studio profiling, BPA rules in CI, Tabular Editor folder serialization for Git, Performance Analyzer audits |
| **Responsible AI** | Data lineage documentation, transparent measure definitions, bias-aware metric design |
