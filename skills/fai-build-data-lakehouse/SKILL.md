---
name: fai-build-data-lakehouse
description: |
  Design lakehouse pipelines with bronze/silver/gold zones, data quality gates,
  governance cataloging, and cost-aware compute tiers. Use when building data
  platforms for AI training data, analytics, or feature engineering.
---

# Data Lakehouse Architecture

Design medallion-architecture data pipelines with quality gates and governance.

## When to Use

- Building data platforms for AI model training data
- Implementing bronze/silver/gold data quality zones
- Setting up data governance with catalog and lineage
- Designing cost-efficient compute for batch and streaming

---

## Medallion Architecture

```
Sources → [Bronze] → [Silver] → [Gold] → Consumers
           Raw        Cleaned    Business    AI Models
           Append     Validated  Aggregated  Dashboards
           Any format Schema     Star schema APIs
```

## ADLS Gen2 Layout

```
datalake/
├── bronze/
│   ├── raw-events/        # Append-only, partitioned by date
│   │   └── year=2026/month=04/day=15/
│   ├── documents/         # Unprocessed files
│   └── api-extracts/      # Raw API responses
├── silver/
│   ├── events-cleaned/    # Deduplicated, validated schema
│   ├── documents-parsed/  # Extracted text + metadata
│   └── embeddings/        # Vector embeddings
├── gold/
│   ├── customer-360/      # Business-ready aggregation
│   ├── training-data/     # ML-ready datasets
│   └── feature-store/     # Feature engineering outputs
└── system/
    ├── checkpoints/       # Pipeline state
    └── audit-logs/        # Data lineage records
```

## Bronze → Silver Promotion

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp

spark = SparkSession.builder.appName("bronze-to-silver").getOrCreate()

# Read raw events
raw = spark.read.json("abfss://bronze@datalake.dfs.core.windows.net/raw-events/")

# Clean: deduplicate, validate schema, add metadata
cleaned = (raw
    .dropDuplicates(["event_id"])
    .filter(col("event_type").isNotNull())
    .withColumn("processed_at", current_timestamp())
    .withColumn("_source", col("_metadata.file_path"))
)

# Quality gate
null_rate = cleaned.filter(col("user_id").isNull()).count() / cleaned.count()
assert null_rate < 0.05, f"Null rate {null_rate:.2%} exceeds 5% threshold"

# Write to silver
cleaned.write.format("delta").mode("merge").save(
    "abfss://silver@datalake.dfs.core.windows.net/events-cleaned/")
```

## Data Quality Gates

| Zone Transition | Check | Threshold | Action on Fail |
|----------------|-------|-----------|---------------|
| Bronze → Silver | Schema validation | 100% match | Quarantine bad records |
| Bronze → Silver | Null rate | < 5% per column | Alert + block promotion |
| Silver → Gold | Dedup rate | < 0.1% duplicates | Re-run dedup before promotion |
| Silver → Gold | Freshness | < 4 hours lag | Alert, investigate source |

## Governance with Purview

```bash
# Register data source
az purview scan create --account-name purview-prod \
  --data-source-name datalake \
  --scan-name weekly-scan \
  --trigger '{"scanLevel": "Full", "schedule": {"frequency": "Week", "interval": 1}}'
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Data quality drift | No zone-level validation | Add schema checks and null-rate gates between zones |
| Duplicate records in gold | Non-idempotent merges | Use merge keys and watermark columns |
| High compute costs | Always-on clusters | Use serverless Spark pools or auto-termination |
| Lineage gaps | No audit trail | Log source file + transform version with each write |
