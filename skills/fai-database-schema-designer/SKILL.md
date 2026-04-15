---
name: fai-database-schema-designer
description: |
  Design relational database schemas with normalization, migration safety,
  query-driven indexing, and constraint enforcement. Use when modeling
  SQL databases for AI application metadata or operational data.
---

# Database Schema Design

Design normalized relational schemas with indexes, constraints, and migration safety.

## When to Use

- Designing a new SQL database for an AI application
- Modeling user data, conversation history, or evaluation results
- Adding indexes for query performance
- Planning schema migrations for production databases

---

## Schema Template

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations table (FK to users)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    model VARCHAR(50) NOT NULL DEFAULT 'gpt-4o-mini',
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    token_count INT NOT NULL DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_status ON conversations(status) WHERE status = 'active';
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

## Normalization Guide

| Normal Form | Rule | Example |
|------------|------|---------|
| 1NF | No repeating groups | Split arrays into rows |
| 2NF | No partial dependencies | Every non-key depends on full PK |
| 3NF | No transitive dependencies | Remove derived columns |
| Denormalize when | Read performance critical | Add token_count to conversation |

## Index Strategy

```sql
-- Covering index for common query
CREATE INDEX idx_conv_user_active ON conversations(user_id, created_at DESC)
    WHERE status = 'active';

-- Partial index (only active rows)
CREATE INDEX idx_active_convs ON conversations(status)
    WHERE status = 'active';
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow queries | Missing index on filter column | Add index matching WHERE clause |
| Orphaned rows | No CASCADE on FK | Add ON DELETE CASCADE or SET NULL |
| Schema migration fails | Non-backward-compatible change | Use expand-contract pattern |
| Constraint violations | Bad data from app | Add CHECK constraints + app validation |

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
