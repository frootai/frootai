---
name: fai-postgresql-optimization
description: |
  Optimize PostgreSQL queries with EXPLAIN ANALYZE, index tuning, query
  rewriting, and configuration adjustments. Use when diagnosing slow queries
  or improving database performance for AI workloads.
---

# PostgreSQL Query Optimization

Diagnose and fix slow queries with EXPLAIN ANALYZE, indexing, and tuning.

## When to Use

- Queries exceeding latency targets
- Identifying missing or unused indexes
- Tuning PostgreSQL configuration for workload
- Optimizing queries for AI application data access

---

## EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT c.id, c.title, COUNT(m.id) as msg_count
FROM conversations c
JOIN messages m ON m.conversation_id = c.id
WHERE c.user_id = 'user-42' AND c.status = 'active'
GROUP BY c.id, c.title
ORDER BY c.created_at DESC
LIMIT 20;

-- Look for:
-- Seq Scan on large tables → needs index
-- Nested Loop with high row count → consider Hash Join
-- Sort with large external sort → increase work_mem
-- Buffers: shared hit ratio < 95% → needs more shared_buffers
```

## Index Strategies

```sql
-- Covering index for common query pattern
CREATE INDEX idx_conv_user_active ON conversations(user_id, created_at DESC)
    WHERE status = 'active';

-- Partial index (only index active rows)
CREATE INDEX idx_active_conversations ON conversations(status)
    WHERE status = 'active';

-- Expression index
CREATE INDEX idx_messages_lower_content ON messages(lower(content));

-- GIN index for JSONB queries
CREATE INDEX idx_metadata ON conversations USING GIN (metadata jsonb_path_ops);
```

## Query Rewriting

```sql
-- Bad: Correlated subquery
SELECT * FROM conversations c
WHERE (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) > 10;

-- Good: JOIN with HAVING
SELECT c.* FROM conversations c
JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id HAVING COUNT(m.id) > 10;

-- Bad: OFFSET pagination (slow for large offsets)
SELECT * FROM messages ORDER BY created_at LIMIT 20 OFFSET 10000;

-- Good: Keyset pagination
SELECT * FROM messages
WHERE created_at < '2026-04-10T00:00:00Z'
ORDER BY created_at DESC LIMIT 20;
```

## Configuration Tuning

| Setting | Default | Recommendation | Why |
|---------|---------|---------------|-----|
| shared_buffers | 128MB | 25% of RAM | Cache more data in memory |
| work_mem | 4MB | 64-256MB | Reduce disk sorts |
| effective_cache_size | 4GB | 75% of RAM | Better query planning |
| random_page_cost | 4.0 | 1.1 (SSD) | Favor index scans on SSD |
| max_connections | 100 | Use pgbouncer | Connection pooling |

## Find Problem Queries

```sql
-- Top 10 slowest queries (requires pg_stat_statements)
SELECT query, calls, mean_exec_time::numeric(10,2) as avg_ms,
       total_exec_time::numeric(10,2) as total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Find unused indexes (wasting write performance)
SELECT schemaname, indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Seq Scan on large table | Missing index | Add index on WHERE/JOIN columns |
| Sort uses disk | work_mem too low | Increase work_mem for session |
| Connection exhaustion | No pooling | Add pgbouncer or connection pool |
| Planner picks wrong plan | Stale statistics | Run ANALYZE on affected tables |
