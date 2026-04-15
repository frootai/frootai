---
name: fai-build-sql-migration
description: |
  Create safe SQL migrations with backward-compatible schema changes, rollback
  scripts, data integrity checks, and CI/CD integration. Use when evolving
  database schemas in production.
---

# SQL Migration Patterns

Safe schema evolution with backward-compatible changes, rollback, and validation.

## When to Use

- Adding columns, tables, or indexes to production
- Renaming or removing columns without downtime
- Data migrations alongside schema changes
- Integrating migrations into CI/CD

---

## File Convention

```
migrations/
  001_create_users.sql
  001_create_users_rollback.sql
  002_add_email.sql
  002_add_email_rollback.sql
```

## Add Column (safe)

```sql
-- 002_add_email.sql
ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL;
CREATE INDEX idx_users_email ON users(email);

-- 002_add_email_rollback.sql
DROP INDEX IF EXISTS idx_users_email;
ALTER TABLE users DROP COLUMN IF EXISTS email;
```

## Rename Column (expand-contract)

```sql
-- Step 1: Add new (app reads both)
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);
UPDATE users SET full_name = name WHERE full_name IS NULL;

-- Step 2: After all app instances migrated
ALTER TABLE users DROP COLUMN name;
```

## Migration Runner

```python
import os, re

def run_migrations(conn, dir):
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
    applied = {r[0] for r in cursor.execute("SELECT name FROM _migrations")}
    for f in sorted(os.listdir(dir)):
        if re.match(r'\d{3}_.*\.sql$', f) and 'rollback' not in f and f not in applied:
            cursor.execute(open(os.path.join(dir, f)).read())
            cursor.execute("INSERT INTO _migrations (name) VALUES (%s)", (f,))
            conn.commit()
```

## Data Integrity Check

```sql
SELECT 'orphans' AS chk, COUNT(*) FROM sessions s
  LEFT JOIN users u ON s.user_id = u.id WHERE u.id IS NULL
UNION ALL
SELECT 'null_emails', COUNT(*) FROM users WHERE email IS NULL AND created_at > '2026-01-01';
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Breaks running app | Non-backward-compatible | Use expand-contract |
| Rollback fails | No rollback script | Always create alongside |
| Duplicate apply | No tracking table | Use _migrations with UNIQUE |
| Slow ALTER | Full table rewrite | Use online DDL or pg_repack |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Always use parameterized queries | Prevent SQL injection |
| Index columns used in WHERE/JOIN | Query performance |
| Use EXPLAIN ANALYZE for slow queries | Evidence-based optimization |
| Test migrations with rollback | Safe schema evolution |
| Monitor query performance | Catch regressions early |
| Least-privilege database access | Security best practice |

## Database Quality Checklist

- [ ] All queries use parameterized inputs
- [ ] Indexes exist for all filter/join columns
- [ ] Migrations have rollback scripts
- [ ] Connection uses Managed Identity
- [ ] Query performance baselined
- [ ] Backup and recovery tested

## Related Skills

- `fai-sql-optimization-skill` — Query performance tuning
- `fai-sql-code-review-skill` — SQL code review
- `fai-database-schema-designer` — Schema design
- `fai-build-sql-migration` — Safe migration patterns
