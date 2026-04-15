---
name: fai-sql-code-review-skill
description: |
  Review SQL code for correctness, performance, security, and maintainability
  across PostgreSQL, SQL Server, and MySQL. Use when auditing SQL in PRs
  or reviewing database migration scripts.
---

# SQL Code Review

Review SQL for correctness, performance, security, and maintainability.

## When to Use

- Reviewing PRs with SQL changes
- Auditing stored procedures or migrations
- Checking for SQL injection vulnerabilities
- Validating query performance before deployment

---

## Review Checklist

| Category | Check | Severity |
|----------|-------|----------|
| Security | Parameterized queries (no concatenation) | Blocking |
| Security | Least-privilege GRANT statements | Blocking |
| Performance | No SELECT * in production code | Warning |
| Performance | WHERE clause uses indexed columns | Warning |
| Performance | LIMIT on all unbounded queries | Warning |
| Correctness | UPDATE/DELETE has WHERE clause | Blocking |
| Correctness | Foreign keys have ON DELETE behavior | Warning |
| Maintainability | Consistent naming (snake_case) | Advisory |
| Maintainability | Comments on complex logic | Advisory |

## Common Anti-Patterns

```sql
-- Anti-pattern 1: SQL injection
-- BAD
EXECUTE('SELECT * FROM users WHERE email = ''' + @email + '''')
-- GOOD
SELECT * FROM users WHERE email = @email

-- Anti-pattern 2: SELECT *
-- BAD (fetches unnecessary columns)
SELECT * FROM conversations WHERE user_id = @uid
-- GOOD
SELECT id, title, status FROM conversations WHERE user_id = @uid

-- Anti-pattern 3: Missing index hint
-- BAD (full table scan on millions of rows)
SELECT * FROM messages WHERE content LIKE '%search%'
-- GOOD (use full-text search)
SELECT * FROM messages WHERE CONTAINS(content, 'search')

-- Anti-pattern 4: N+1 query pattern
-- BAD (loop in app code)
FOR EACH conversation: SELECT * FROM messages WHERE conv_id = ?
-- GOOD (single query)
SELECT c.*, m.* FROM conversations c
JOIN messages m ON m.conversation_id = c.id
WHERE c.user_id = @uid
```

## Migration Safety

```sql
-- Safe: ADD COLUMN nullable (no table rewrite)
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- Unsafe: ADD NOT NULL without default (blocks writes on large table)
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NOT NULL DEFAULT '';
-- Fix: Add nullable → backfill → add constraint
```

## Performance Review

```sql
-- Always check execution plan for reviewed queries
EXPLAIN ANALYZE [query];
-- Look for: Seq Scan, Nested Loop with high rows, Sort on disk
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| SQL injection found | String concatenation | Use parameterized queries |
| Slow migration | Table rewrite on ALTER | Use nullable-first pattern |
| Missing index | No EXPLAIN in review | Require EXPLAIN for new queries |
| Inconsistent naming | No convention | Enforce snake_case in linter |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Tests before refactoring | Safety net for behavior preservation |
| One refactoring per commit | Easy to revert specific changes |
| No feature changes mixed in | Separate refactor from feature PRs |
| Measure complexity before/after | Prove improvement objectively |
| Small PRs (< 200 lines changed) | Easier to review thoroughly |
| CI must pass after each step | Catch breakage immediately |

## Refactoring Safety Checklist

- [ ] All existing tests pass before starting
- [ ] Each refactoring step committed separately
- [ ] No behavior changes (same inputs → same outputs)
- [ ] All tests still pass after each step
- [ ] Complexity metrics improved
- [ ] PR is under 200 lines of changes

## Related Skills

- `fai-refactor-complexity` — Reduce cyclomatic complexity
- `fai-refactor-plan` — Multi-sprint refactoring plans
- `fai-code-smell-detector` — Automated smell detection
- `fai-review-and-refactor` — Combined review + fix workflow
