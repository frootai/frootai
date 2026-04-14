---
description: "SQL optimization standards — index strategy, query plans, normalized design, and migration patterns."
applyTo: "**/*.sql"
waf:
  - "performance-efficiency"
  - "reliability"
---

# SQL Optimization — FAI Standards

## Indexing Strategy

Design indexes for your query workload, not your table structure.

```sql
-- Composite index: leftmost prefix rule — put equality columns first, range last
CREATE NONCLUSTERED INDEX IX_Orders_Status_Date
ON Orders (Status, CustomerId, OrderDate DESC);

-- Covering index: eliminates key lookups by including non-key columns
CREATE NONCLUSTERED INDEX IX_Orders_Covering
ON Orders (CustomerId, Status)
INCLUDE (TotalAmount, OrderDate);

-- Filtered index: smaller, faster — only index rows that matter
CREATE NONCLUSTERED INDEX IX_Orders_Active
ON Orders (CustomerId, OrderDate)
WHERE Status = 'Active'
WITH (FILLFACTOR = 90);
```

- Composite indexes: equality predicates first, then inequality, then ORDER BY columns
- Limit to ≤5 key columns per index — wide indexes slow writes disproportionately
- Review missing index DMVs monthly: `sys.dm_db_missing_index_details`
- Drop unused indexes: `sys.dm_db_index_usage_stats` where `user_seeks + user_scans = 0` over 30 days

## Query Plan Analysis

```sql
-- Lightweight: logical I/O counts per table (most useful single diagnostic)
SET STATISTICS IO ON;
SELECT c.Name, COUNT(*) FROM Orders o JOIN Customers c ON o.CustomerId = c.Id
WHERE o.OrderDate > '2025-01-01' GROUP BY c.Name;
SET STATISTICS IO OFF;

-- Full plan: look for Scans, Key Lookups, Hash Matches on small sets, fat arrows
SET STATISTICS PROFILE ON; -- or use CTRL+M in SSMS for actual execution plan
```

- Key Lookup + Nested Loop on >1000 rows → add INCLUDE columns to eliminate lookup
- Table Scan on >10K rows → missing index or non-SARGable predicate
- Hash Match Join on small tables → outdated statistics or cardinality misestimate
- Sort operator with spill to tempdb → add index matching ORDER BY or increase memory grant

## N+1 Detection and Elimination

```sql
-- ❌ N+1: application loops calling this per customer
SELECT * FROM Orders WHERE CustomerId = @id;

-- ✅ Batch: single round-trip with JOIN or IN clause
SELECT c.Id, c.Name, o.OrderId, o.TotalAmount
FROM Customers c
JOIN Orders o ON c.Id = o.CustomerId
WHERE c.Region = @region;
```

- Identify via `sys.dm_exec_query_stats` — queries with high `execution_count` but low `total_rows`
- ORM-generated queries: enable SQL logging, grep for repeated single-row SELECTs
- Fix at data access layer: eager loading, batch fetching, or materialized views

## Pagination

```sql
-- ❌ OFFSET/FETCH: performance degrades linearly — page 10000 reads 100K rows
SELECT * FROM Products ORDER BY Id OFFSET 99980 ROWS FETCH NEXT 20 ROWS ONLY;

-- ✅ Keyset pagination: constant performance regardless of page depth
SELECT TOP 20 * FROM Products WHERE Id > @lastSeenId ORDER BY Id;

-- Keyset with composite sort (non-unique column + tiebreaker)
SELECT TOP 20 * FROM Products
WHERE (Rating < @lastRating) OR (Rating = @lastRating AND Id > @lastId)
ORDER BY Rating DESC, Id ASC;
```

- Use keyset/cursor pagination for any dataset >10K rows or API endpoints
- OFFSET/FETCH acceptable only for admin UIs with bounded page counts (<100 pages)

## CTEs vs Subqueries vs Temp Tables

```sql
-- CTE: readable, single-use — optimizer inlines it (no materialization guarantee)
WITH ActiveOrders AS (
    SELECT CustomerId, COUNT(*) AS OrderCount
    FROM Orders WHERE Status = 'Active' GROUP BY CustomerId
)
SELECT c.Name, ao.OrderCount FROM Customers c JOIN ActiveOrders ao ON c.Id = ao.CustomerId;

-- Temp table: materialized, indexed — use when CTE is referenced multiple times or >100K rows
SELECT CustomerId, COUNT(*) AS OrderCount
INTO #ActiveOrders FROM Orders WHERE Status = 'Active' GROUP BY CustomerId;
CREATE INDEX IX_tmp ON #ActiveOrders (CustomerId);
-- join against #ActiveOrders multiple times here
DROP TABLE #ActiveOrders;
```

- CTEs referenced once → let optimizer inline. CTEs referenced 2+ times → temp table
- Recursive CTEs: set `OPTION (MAXRECURSION 100)` — default 100, 0 = unlimited (dangerous)
- Avoid nested subqueries >2 levels deep — extract to CTE or temp table for readability

## Window Functions

```sql
-- Pagination / deduplication with ROW_NUMBER
SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate DESC) AS rn
    FROM Orders
) ranked WHERE rn = 1; -- latest order per customer

-- Change detection with LAG
SELECT OrderId, TotalAmount,
    TotalAmount - LAG(TotalAmount) OVER (PARTITION BY CustomerId ORDER BY OrderDate) AS Delta
FROM Orders;

-- Running total (careful: no index can accelerate ROWS UNBOUNDED PRECEDING on large sets)
SELECT OrderId, OrderDate, TotalAmount,
    SUM(TotalAmount) OVER (PARTITION BY CustomerId ORDER BY OrderDate
        ROWS UNBOUNDED PRECEDING) AS RunningTotal
FROM Orders;
```

- Window functions avoid self-joins but still scan the partition — keep partitions bounded
- ROWS vs RANGE: prefer ROWS (deterministic, faster) unless you need RANGE semantics for ties

## Batch Operations

```sql
-- Bulk insert from another table — no row-by-row cursor
INSERT INTO OrderArchive (OrderId, CustomerId, OrderDate, TotalAmount)
SELECT OrderId, CustomerId, OrderDate, TotalAmount
FROM Orders WHERE OrderDate < DATEADD(YEAR, -2, GETDATE());

-- MERGE: atomic upsert — use OUTPUT to audit what changed
MERGE INTO Products AS tgt
USING StagingProducts AS src ON tgt.SKU = src.SKU
WHEN MATCHED THEN UPDATE SET tgt.Price = src.Price, tgt.UpdatedAt = GETDATE()
WHEN NOT MATCHED THEN INSERT (SKU, Name, Price, UpdatedAt) VALUES (src.SKU, src.Name, src.Price, GETDATE())
OUTPUT $action, inserted.SKU;

-- Large deletes: batch to avoid lock escalation and log growth
WHILE 1 = 1 BEGIN
    DELETE TOP (5000) FROM AuditLog WHERE CreatedAt < DATEADD(MONTH, -6, GETDATE());
    IF @@ROWCOUNT = 0 BREAK;
END;
```

## Deadlock Prevention

- Access tables in consistent alphabetical order across all transactions
- Keep transactions short — do reads outside, writes inside
- Use `READ COMMITTED SNAPSHOT` (RCSI) to eliminate reader-writer blocking
- Index foreign key columns to prevent table scans during parent deletes

## Parameter Sniffing

```sql
-- When first-compiled plan is bad for subsequent parameter values
CREATE PROCEDURE GetOrders @Status NVARCHAR(20) AS
SELECT * FROM Orders WHERE Status = @Status
OPTION (RECOMPILE); -- recompile each call — use when data skew is extreme

-- Alternative: OPTIMIZE FOR UNKNOWN — generic plan, no sniffing
SELECT * FROM Orders WHERE Status = @Status OPTION (OPTIMIZE FOR (@Status UNKNOWN));
```

- Detect via `sys.dm_exec_query_stats`: same `query_hash`, wildly different `last_elapsed_time`
- Plan guides: last resort for vendor SQL you cannot modify

## Statistics and Maintenance

- Enable `AUTO_UPDATE_STATISTICS_ASYNC` — prevents query blocking on stats refresh
- Manual update after bulk loads: `UPDATE STATISTICS Orders WITH FULLSCAN`
- Rebuild indexes when fragmentation >30%: `ALTER INDEX IX_Orders_Status ON Orders REBUILD`
- Reorganize when 10-30%: `ALTER INDEX IX_Orders_Status ON Orders REORGANIZE`

## Connection Pooling and Read Replicas

- Set pool min/max in connection string: `Min Pool Size=5; Max Pool Size=100`
- Route reporting/analytics to read replica: `ApplicationIntent=ReadOnly` in connection string
- Close connections explicitly — leaked connections exhaust the pool under load
- Monitor via `sys.dm_exec_connections` and pool counters in APM

## Schema Design Tradeoffs

- Normalize to 3NF by default — denormalize only with measured query evidence
- Denormalization candidates: fields always JOINed and rarely updated (e.g., CustomerName on Orders)
- Use computed columns over triggers for derived values
- JSON columns (`NVARCHAR(MAX)` with `ISJSON` check) for semi-structured data — but never query inside JSON at scale without computed column + index

## Anti-Patterns

- ❌ `SELECT *` in production — fetches unused columns, breaks covering indexes
- ❌ Functions on indexed columns in WHERE: `WHERE YEAR(OrderDate) = 2025` → non-SARGable
- ❌ Implicit conversions: `WHERE VarcharCol = 12` forces scan — match types explicitly
- ❌ Cursors for set-based operations — rewrite as INSERT...SELECT or window function
- ❌ NOLOCK hint everywhere — reads dirty/phantom data, use RCSI instead
- ❌ Over-indexing write-heavy tables — each index adds overhead to INSERT/UPDATE/DELETE
- ❌ Missing WHERE on UPDATE/DELETE — always test with SELECT first
- ❌ Unbounded SELECT without TOP or pagination — OOM risk on large tables

## WAF Alignment

| Pillar | SQL Practice |
|--------|-------------|
| **Performance Efficiency** | Covering indexes, keyset pagination, batch operations, window functions over self-joins, query plan analysis |
| **Reliability** | Deadlock prevention via consistent access order, RCSI isolation, batched deletes to prevent log explosion, statistics maintenance |
| **Cost Optimization** | Read replicas for reporting workloads, filtered indexes (smaller storage), drop unused indexes, right-sized connection pools |
| **Operational Excellence** | DMV monitoring for missing indexes + query stats, automated index maintenance, `SET STATISTICS IO` in dev workflow |
| **Security** | Parameterized queries (never string concat), least-privilege database roles, `EXECUTE AS` for stored procedures, audit via OUTPUT clause |
