---
description: "MongoDB standards — schema design, indexes, aggregation pipelines, and Atlas Vector Search patterns."
applyTo: "**/*.js, **/*.ts"
waf:
  - "performance-efficiency"
  - "reliability"
---

# MongoDB — FAI Standards

## Schema Design

- Embed for 1:1 and 1:few; reference (ObjectId) for 1:many and many:many
- Document size hard limit: **16MB** — denormalize selectively, never store blobs inline
- **Subset Pattern** for large arrays (keep recent N, overflow to separate collection)
- **Bucket Pattern** for time-series (group measurements into fixed-size documents)
- Schema versioning field (`schemaVersion: 1`) for incremental migrations

```python
# pymongo — Embed 1:1, reference 1:many
db.users.insert_one({"name": "Alice", "address": {"city": "Seattle", "zip": "98101"}})
db.orders.insert_one({"user_id": user["_id"], "items": [{"sku": "A1", "qty": 2}]})
```

```typescript
// mongoose — Schema with validation
const productSchema = new Schema({
  name: { type: String, required: true, maxlength: 200, index: true },
  price: { type: Number, required: true, min: 0 },
  tags: { type: [String], validate: [v => v.length <= 20, "Max 20 tags"] },
  schemaVersion: { type: Number, default: 1 }
}, { timestamps: true, strict: true });
```

## Indexing Strategy

- Every query must hit an index — `.explain("executionStats")`, reject `COLLSCAN`
- Compound indexes: **ESR rule** (Equality → Sort → Range, left to right)
- Covered queries: include projected fields in index to skip document fetch
- TTL for auto-expiration; partial indexes for filtered subsets; text indexes (1/collection)
- Max 50 indexes per collection — each adds write overhead

```python
db.orders.create_index([("user_id", 1), ("created_at", -1)])  # Compound (ESR)
db.sessions.create_index("expires_at", expireAfterSeconds=0)   # TTL
db.logs.create_index("level", partialFilterExpression={"level": "error"})  # Partial
# Verify: plan["executionStats"]["totalDocsExamined"] should be low
```

## Aggregation Pipelines

- `$match` + `$project` first — filter early, reduce fields before heavy stages
- `$lookup`: add `pipeline` sub-query to filter joined docs server-side
- `$facet` for parallel branches; `allowDiskUse=True` when >100MB; `$merge`/`$out` for materialized views

```python
# pymongo — $facet for paginated results + count in one query
pipeline = [
    {"$match": {"status": "active", "region": region}},
    {"$facet": {
        "data": [{"$sort": {"score": -1}}, {"$skip": offset}, {"$limit": size},
                 {"$project": {"name": 1, "score": 1, "_id": 0}}],
        "total": [{"$count": "count"}]
    }}
]
```

## Change Streams & Transactions

- Change streams: `resume_after` token for crash recovery; require replica set
- Transactions: keep short (<60s), `w: "majority"` + `readConcern: "snapshot"`, `readPreference: "secondaryPreferred"` for analytics

```python
# motor — Change stream with crash-safe resume
async def watch_changes(collection):
    async with collection.watch(
        [{"$match": {"operationType": {"$in": ["insert", "update"]}}}],
        resume_after=load_checkpoint()) as stream:
        async for change in stream:
            await process_event(change)
            save_checkpoint(stream.resume_token)

# motor — Transaction with write concern
async def transfer(client, from_id, to_id, amount):
    async with await client.start_session() as s:
        async with s.start_transaction(write_concern=WriteConcern("majority")):
            await db.accounts.update_one({"_id": from_id, "balance": {"$gte": amount}},
                                         {"$inc": {"balance": -amount}}, session=s)
            await db.accounts.update_one({"_id": to_id}, {"$inc": {"balance": amount}}, session=s)
```

## Connection Pooling & Bulk Ops
- Tune `maxPoolSize`; set `serverSelectionTimeoutMS` (default 30s too long for web)
- `bulkWrite` for mixed ops, `insert_many(ordered=False)` for parallel inserts

```typescript
// mongoose — Connection pooling + bulk upsert
await mongoose.connect(process.env.MONGODB_URI!, {
  maxPoolSize: 50, minPoolSize: 5, serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000, retryWrites: true, w: "majority"
});
await Product.bulkWrite(
  items.map(i => ({ updateOne: { filter: { sku: i.sku }, update: { $set: { price: i.price } }, upsert: true } })),
  { ordered: false }
);
```

## Atlas Vector Search (RAG)
- Vector index on embedding field; dimensions must match model (3-small=1536, 3-large=3072)
- `$vectorSearch` in aggregation — combine with `$match` for metadata pre-filtering

```python
# pymongo — Atlas Vector Search for RAG
def vector_search(col, query_vec: list[float], k: int = 5, min_score: float = 0.7):
    return list(col.aggregate([
        {"$vectorSearch": {
            "index": "vector_index", "path": "embedding",
            "queryVector": query_vec, "numCandidates": k * 10, "limit": k,
            "filter": {"status": "published"}
        }},
        {"$project": {"text": 1, "source": 1, "score": {"$meta": "vectorSearchScore"}, "_id": 0}},
        {"$match": {"score": {"$gte": min_score}}}
    ]))
```

## Query Patterns & Atlas Search
- Always project — `find(query, {"name": 1})`, never fetch full documents
- Avoid `$where`, unanchored `$regex` — cause collection scans
- Paginate with range cursor (`_id > last_seen`) not `skip(N).limit(M)`
- Atlas Search (Lucene) for faceted/fuzzy/autocomplete; Atlas Triggers for event-driven logic

## Anti-Patterns

- ❌ Unbounded arrays growing to thousands — causes 16MB limit hits
- ❌ Storing blobs in documents — use GridFS or external storage
- ❌ `find({})` without projection; `$lookup` across sharded collections (unsupported)
- ❌ Connection strings in source code — use env vars or Key Vault
- ❌ `skip(10000).limit(20)` — O(n), use range cursor instead
- ❌ Over-embedding 3+ levels; missing `writeConcern: "majority"` on critical writes

## WAF Alignment

| Pillar | MongoDB Practice |
| --- | --- |
| **Performance** | Compound indexes (ESR), covered queries, projection, `$facet` pagination, connection pooling |
| **Reliability** | `w: "majority"`, change stream resume tokens, transactions with retry, replica set failover |
| **Security** | SCRAM-SHA-256 auth, TLS, field-level encryption (CSFLE/Queryable Encryption), IP allowlisting |
| **Cost** | Partial indexes, TTL auto-cleanup, right-sized `maxPoolSize`, `$project` early in pipelines |
| **Operations** | Atlas monitoring, slow query profiler (`db.setProfilingLevel(1, {slowms: 100})`), rolling index builds |
| **Responsible AI** | PII field-level encryption, audit logging for data access, GDPR right-to-erasure via `deleteMany` |
