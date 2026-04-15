---
name: fai-sql-optimization-skill
description: |
  Optimize SQL queries with execution plan analysis, index tuning, query
  rewriting, and statistics management. Use when diagnosing slow queries
  across PostgreSQL, SQL Server, or MySQL.
---

# SQL Query Optimization

Diagnose and fix slow queries with execution plans, indexes, and rewrites.

## When to Use

- Queries exceeding latency SLOs
- High CPU or I/O from database operations
- Identifying missing or redundant indexes
- Tuning queries for AI application data access

---

## Execution Plan Analysis

```sql
-- PostgreSQL
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;

-- SQL Server
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
-- Then run query, check Messages tab

-- MySQL
EXPLAIN FORMAT=TREE SELECT ...;
```

## Key Plan Red Flags

| Signal | Problem | Fix |
|--------|---------|-----|
| Seq Scan / Table Scan | Full table read | Add index on filter columns |
| Nested Loop (high rows) | N+1 join pattern | Consider Hash/Merge Join |
| Sort (external) | work_mem too low | Increase work_mem or add sorted index |
| Key Lookup | Non-covering index | Add INCLUDE columns |

## Index Optimization

```sql
-- Composite index for common query pattern
CREATE INDEX idx_conv_user_status ON conversations(user_id, status, created_at DESC);

-- Covering index (avoids key lookup)
CREATE INDEX idx_msg_conv_covering ON messages(conversation_id)
    INCLUDE (role, content, created_at);

-- Partial index (index only relevant rows)
CREATE INDEX idx_active_conv ON conversations(user_id)
    WHERE status = 'active';

-- Find unused indexes
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;
```

## Query Rewriting

```sql
-- Bad: Correlated subquery
SELECT * FROM conversations c
WHERE (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) > 10;

-- Good: JOIN with HAVING
SELECT c.id, COUNT(m.id) FROM conversations c
JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id HAVING COUNT(m.id) > 10;

-- Bad: OFFSET pagination
SELECT * FROM messages ORDER BY created_at LIMIT 20 OFFSET 50000;

-- Good: Keyset pagination
SELECT * FROM messages WHERE created_at < @last_seen
ORDER BY created_at DESC LIMIT 20;
```

## Statistics Management

```sql
-- PostgreSQL: Update table statistics
ANALYZE conversations;
ANALYZE messages;

-- SQL Server: Update statistics
UPDATE STATISTICS conversations;
UPDATE STATISTICS messages;
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Seq scan on indexed column | Statistics stale | Run ANALYZE |
| Slow with LIKE '%text%' | B-tree can't use leading wildcard | Use full-text search or GIN trigram |
| Join order wrong | Planner estimates off | Update statistics, consider join hints |
| Index not used | Type mismatch in WHERE | Ensure column and parameter types match |
