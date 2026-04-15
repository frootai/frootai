---
name: fai-build-nosql-data-model
description: |
  Design NoSQL data models with partition strategies, access patterns, denormalization,
  and consistency tradeoffs. Use when modeling data for Cosmos DB, DynamoDB, or MongoDB.
---

# NoSQL Data Modeling

Design document-store schemas optimized for query patterns and partition efficiency.

## When to Use

- Designing Cosmos DB containers for AI application data
- Modeling chat history, user profiles, or session state
- Migrating from relational to document model
- Optimizing for read-heavy or write-heavy patterns

---

## Modeling Principles

| Principle | Relational | NoSQL |
|-----------|-----------|-------|
| Schema | Normalized tables | Denormalized documents |
| Joins | SQL JOINs | Embed related data |
| Partition | N/A | Partition key = query filter |
| Consistency | Strong (ACID) | Tunable |

## Single-Table Design

```json
{"pk": "USER#u123", "sk": "PROFILE", "name": "Alice", "email": "alice@org.com"}
{"pk": "USER#u123", "sk": "SESSION#2026-04-15", "model": "gpt-4o", "tokens": 4500}
```

## Cosmos DB Query

```python
container.query_items(
    query="SELECT * FROM c WHERE c.userId = @uid ORDER BY c.timestamp DESC",
    parameters=[{"name": "@uid", "value": "user-123"}],
    partition_key="user-123",
)
```

## Partition Key Selection

| Access Pattern | Good Key | Why |
|---------------|----------|-----|
| User data | userId | Scoped queries |
| Chat sessions | sessionId | Co-locates messages |
| Multi-tenant | tenantId | Natural isolation |
| IoT | deviceId | High cardinality |
| **Avoid** | status, country | Hot partitions |

## Denormalization

```json
{"id": "order-456", "userId": "u123",
  "items": [{"name": "Widget", "price": 29.99, "qty": 2}],
  "total": 59.98, "customerName": "Alice"}
```

**Why embed?** One read vs three JOINs. **Tradeoff:** Name changes need propagation.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Hot partitions (429s) | Low-cardinality key | Choose high-cardinality key |
| High RU cost | Cross-partition queries | Add partition key to WHERE |
| Stale embedded data | No propagation | Use change feed |
| Large documents | Unbounded arrays | Cap array size |

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
