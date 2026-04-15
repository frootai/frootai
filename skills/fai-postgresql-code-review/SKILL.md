---
name: fai-postgresql-code-review
description: |
  Review PostgreSQL code for performance, security, and maintainability with
  query analysis, index recommendations, and anti-pattern detection. Use when
  auditing SQL code or reviewing database PRs.
---

# PostgreSQL Code Review

Review SQL code for performance, security, and correctness.

## When to Use

- Reviewing PRs that include SQL changes
- Auditing existing queries for performance
- Detecting SQL anti-patterns and security issues
- Recommending index improvements

---

## Performance Review

```sql
-- Anti-pattern: SELECT * (fetches unnecessary columns)
-- Bad
SELECT * FROM conversations WHERE user_id = 'user-42';
-- Good
SELECT id, title, status, created_at FROM conversations WHERE user_id = 'user-42';

-- Anti-pattern: Missing index on filter column
-- Check with EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT id FROM messages WHERE conversation_id = 'conv-123';
-- Look for "Seq Scan" → needs index

-- Fix
CREATE INDEX idx_messages_conv_id ON messages(conversation_id);
```

## Security Review

```sql
-- Anti-pattern: String concatenation (SQL injection)
-- Bad (Python)
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

-- Good (parameterized)
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))

-- Anti-pattern: Overly permissive GRANT
-- Bad
GRANT ALL PRIVILEGES ON ALL TABLES TO app_user;
-- Good
GRANT SELECT, INSERT, UPDATE ON conversations, messages TO app_user;
```

## Query Analysis Checklist

| Check | Look For | Fix |
|-------|----------|-----|
| Sequential scan | Seq Scan on large table | Add index on filter columns |
| N+1 queries | Loop of SELECT per row | Use JOIN or batch query |
| Missing WHERE | UPDATE/DELETE without filter | Always add WHERE clause |
| Large result sets | No LIMIT on SELECT | Add LIMIT + pagination |
| Implicit casting | Type mismatch in WHERE | Match column types |
| Missing transactions | Multi-step changes | Wrap in BEGIN/COMMIT |

## Index Recommendations

```sql
-- Find most expensive queries (pg_stat_statements)
SELECT query, calls, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Find unused indexes
SELECT indexrelname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Migration Safety

```sql
-- Safe: ADD COLUMN with NULL default (no table rewrite)
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- Unsafe: ADD COLUMN with NOT NULL default (rewrites table)
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
-- Fix: Add nullable first, backfill, then add constraint
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow query | Missing index | Run EXPLAIN ANALYZE, add index |
| SQL injection | String concatenation | Use parameterized queries |
| Lock contention | Long transaction | Shorten transactions, use SKIP LOCKED |
| Migration timeout | Table rewrite on large table | Use pg_repack or online migration |
