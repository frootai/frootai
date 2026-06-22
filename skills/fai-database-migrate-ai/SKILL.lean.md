---
name: fai-database-migrate-ai
description: "Migrate AI data, embeddings, and index schemas with zero-downtime cutovers - preserve compatibility, validate every step, and keep rollback ready"
---

# Database Migration for AI Workloads

## Conversation History — Cosmos DB Schema Migration

Design partition keys around `session_id` for hot-path reads and `/user_id` for cross-session analytics. When adding fields (e.g., `feedback_score`, `tool_calls[]`), use Cosmos DB's schema-free nature — backfill with a change feed processor:

```python
# backfill_conversations.py — add tool_calls field to existing docs
from azure.cosmos import CosmosClient, PartitionKey
import os

client = CosmosClient(os.environ["COSMOS_ENDPOINT"], os.environ["COSMOS_KEY"])
container = client.get_database_client("ai-app").get_container_client("conversations")

query = "SELECT * FROM c WHERE NOT IS_DEFINED(c.tool_calls)"
for doc in container.query_items(query, enable_cross_partition_query=True):
    doc["tool_calls"] = []
    doc["schema_version"] = 2
    container.upsert_item(doc)
```

Always add a `schema_version` integer to every document. Application code reads both v1 and v2 shapes, writes only v2. Once backfill completes and monitoring confirms zero v1 reads, remove v1 compat code.

## Vector Index Migration — AI Search Index Versioning

Never mutate a production index in place. Create a versioned index, populate it, then swap the alias:

```bash
# 1. Create new index with updated schema (e.g., added filterable field)
az search index create --service-name $SEARCH_SVC --resource-group $RG \
  --name "knowledge-v3" --fields @index-schema-v3.json

# 2. Re-index from Cosmos DB change feed or blob storage
az search indexer create --service-name $SEARCH_SVC --resource-group $RG \
  --name "indexer-v3" --data-source "cosmos-ds" --target-index "knowledge-v3" \
  --skillset "enrichment-pipeline"

# 3. Wait for indexer to complete, then swap alias
az search alias create-or-update --service-name $SEARCH_SVC --resource-group $RG \
  --name "knowledge" --indexes "knowledge-v3"

# 4. Delete old index after validation period (24-48h)
az search index delete --service-name $SEARCH_SVC --name "knowledge-v2" --yes
```

Application code always queries via the alias `knowledge`, never the versioned index name.

## Embedding Model Version Upgrades

When upgrading from `text-embedding-ada-002` to `text-embedding-3-large`, all vectors must be re-embedded — dimensions and geometry differ. Run re-embedding as a background job:

```python
# re_embed.py — batch re-embedding with checkpoint
import json, os
from openai import AzureOpenAI
from azure.search.documents import SearchClient
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
oai = AzureOpenAI(azure_endpoint=os.environ["AOAI_ENDPOINT"], azure_ad_token_provider=credential)
search = SearchClient(os.environ["SEARCH_ENDPOINT"], "knowledge-v3", credential)

BATCH, CHECKPOINT_FILE = 100, "re_embed_checkpoint.json"

# Resume from checkpoint
checkpoint = json.load(open(CHECKPOINT_FILE)) if os.path.exists(CHECKPOINT_FILE) else {"last_id": None}

results = search.search("*", top=BATCH, order_by="id", filter=f"id gt '{checkpoint['last_id']}'" if checkpoint["last_id"] else None)
batch = list(results)

while batch:
    texts = [doc["content"] for doc in batch]
    embeddings = oai.embeddings.create(input=texts, model="text-embedding-3-large", dimensions=1536).data
    updates = [{"id": batch[i]["id"], "content_vector": embeddings[i].embedding} for i in range(len(batch))]
    search.merge_documents(updates)
    checkpoint["last_id"] = batch[-1]["id"]
    json.dump(checkpoint, open(CHECKPOINT_FILE, "w"))
    batch = list(search.search("*", top=BATCH, order_by="id", filter=f"id gt '{checkpoint['last_id']}'"))
```

Key rules: keep both old and new vector fields during transition. Query both and merge results until re-embedding completes. Delete old vector field only after 100% coverage verified.

## Config Schema Migration (`config/*.json`)

When `config/openai.json` or `config/guardrails.json` schema changes, write a migration script — never hand-edit production configs:

```python
# migrate_config.py — v1 → v2 config migration
import json, shutil, sys
from pathlib import Path

config_path = Path(sys.argv[1])  # e.g., config/openai.json
shutil.copy(config_path, config_path.with_suffix(".json.bak"))  # backup first

config = json.loads(config_path.read_text())

# v1→v2: rename "model" to "deployment", add fallback array
if "schema_version" not in config or config["schema_version"] < 2:
    if "model" in config:
        config["deployment"] = config.pop("model")
    config.setdefault("fallback_models", [])
    config.setdefault("max_retries", 3)
    config["schema_version"] = 2

config_path.write_text(json.dumps(config, indent=2))
print(f"Migrated {config_path} to schema v2")
```

## Zero-Downtime Migration Pattern

Use blue-green with a feature flag to avoid downtime during data migrations:

1. **Deploy new code** that reads both old and new schema (backward-compatible)
2. **Run migration job** in background — backfill/re-embed/re-index
3. **Monitor** migration progress via App Insights custom metrics
4. **Flip feature flag** to write new schema only once migration reaches 100%
5. **Remove old-schema compat code** in next release after bake period

For Cosmos DB, use the change feed to keep old and new containers in sync during the transition window.

## Alembic Migration for Metadata DB

AI apps often have a SQL metadata DB (users, API keys, usage tracking). Use Alembic for schema migrations:

```python
# alembic/versions/003_add_token_usage.py
"""Add token usage tracking columns"""
from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"

def upgrade():
    op.add_column("conversations", sa.Column("prompt_tokens", sa.Integer, default=0))
    op.add_column("conversations", sa.Column("completion_tokens", sa.Integer, default=0))
    op.add_column("conversations", sa.Column("model_deployment", sa.String(64), nullable=True))
    op.create_index("ix_conversations_model", "conversations", ["model_deployment"])

def downgrade():
    op.drop_index("ix_conversations_model")
    op.drop_column("conversations", "model_deployment")
    op.drop_column("conversations", "completion_tokens")
    op.drop_column("conversations", "prompt_tokens")
```

Run with: `alembic upgrade head` — always run against staging DB first.

## Post-Migration Data Validation

After every migration, run validation to catch silent data corruption:

```python
# validate_migration.py
from azure.cosmos import CosmosClient
import os, sys

client = CosmosClient(os.environ["COSMOS_ENDPOINT"], os.environ["COSMOS_KEY"])
container = client.get_database_client("ai-app").get_container_client("conversations")

checks = {
    "missing_schema_version": "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.schema_version)",
    "null_vectors": "SELECT VALUE COUNT(1) FROM c WHERE IS_NULL(c.content_vector)",
    "orphan_sessions": "SELECT VALUE COUNT(1) FROM c WHERE NOT IS_DEFINED(c.user_id)",
}

failures = []
for name, query in checks.items():
    count = list(container.query_items(query, enable_cross_partition_query=True))[0]
    status = "PASS" if count == 0 else "FAIL"
    print(f"  [{status}] {name}: {count} docs")
    if count > 0:
        failures.append(name)

sys.exit(1 if failures else 0)
```

Wire this into CI: migration PR must include a validation script that gates merge.

## Rollback Procedures

Every migration must have a rollback plan documented before execution:

- **Cosmos DB**: restore from continuous backup to point-in-time before migration started (`az cosmosdb sql container restore`)
- **AI Search**: alias swap back to previous index version — instant rollback
- **Config files**: `.bak` files created by migration script, `cp config/openai.json.bak config/openai.json`
- **SQL (Alembic)**: `alembic downgrade -1` — every `upgrade()` must have a matching `downgrade()`
- **Embeddings**: keep old vector field for 48h; if new embeddings degrade retrieval quality, revert alias to old index

## Migration Testing in Staging

```bash
#!/bin/bash
# test_migration.sh — run full migration cycle against staging
set -euo pipefail

export COSMOS_ENDPOINT="https://cosmos-staging.documents.azure.com"
export SEARCH_ENDPOINT="https://search-staging.search.windows.net"

echo "=== Pre-migration snapshot ==="
python validate_migration.py

echo "=== Running migration ==="
python backfill_conversations.py
python re_embed.py
python migrate_config.py config/openai.json
alembic upgrade head

echo "=== Post-migration validation ==="
python validate_migration.py

echo "=== Smoke test: query pipeline ==="
curl -sf "$APP_URL/api/chat" -d '{"query":"test"}' -H "Content-Type: application/json" | jq .answer

echo "=== Rollback test ==="
alembic downgrade -1
alembic upgrade head  # re-apply to confirm idempotency

echo "Migration test PASSED"
```

Run staging migration at least 24h before production. Compare retrieval quality metrics (MRR@10, NDCG) pre/post migration to catch embedding regression.
