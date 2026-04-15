---
name: fai-fabric-lakehouse
description: |
  Design Microsoft Fabric Lakehouse architectures with OneLake storage, medallion
  zones, Spark notebooks, and data governance. Use when building analytics
  platforms on Fabric for AI-ready data.
---

# Microsoft Fabric Lakehouse

Design Fabric Lakehouse with medallion architecture, Spark pipelines, and governance.

## When to Use

- Building analytics platforms on Microsoft Fabric
- Implementing bronze/silver/gold data zones in OneLake
- Creating Spark notebooks for data transformation
- Setting up data governance with Purview integration

---

## OneLake Structure

```
my-workspace/
  my-lakehouse.Lakehouse/
    Tables/         # Delta tables (managed)
    Files/          # Unstructured files
      bronze/       # Raw ingestion
      silver/       # Cleaned and validated
      gold/         # Business-ready aggregations
```

## Spark Notebook: Bronze to Silver

```python
# Fabric Spark notebook
from pyspark.sql.functions import col, current_timestamp, lit

# Read raw JSON from bronze
raw = spark.read.json("Files/bronze/events/2026/04/")

# Clean and validate
cleaned = (raw
    .dropDuplicates(["event_id"])
    .filter(col("event_type").isNotNull())
    .withColumn("processed_at", current_timestamp())
    .withColumn("source_zone", lit("bronze"))
)

# Assert quality gate
null_rate = cleaned.filter(col("user_id").isNull()).count() / cleaned.count()
assert null_rate < 0.05, f"Null rate {null_rate:.2%} exceeds threshold"

# Write to silver Delta table
cleaned.write.format("delta").mode("append").saveAsTable("silver_events")
```

## Silver to Gold Aggregation

```python
from pyspark.sql.functions import count, avg, sum as spark_sum

gold = (spark.table("silver_events")
    .groupBy("event_type", "model")
    .agg(
        count("*").alias("event_count"),
        avg("latency_ms").alias("avg_latency_ms"),
        spark_sum("tokens").alias("total_tokens"),
    ))

gold.write.format("delta").mode("overwrite").saveAsTable("gold_model_usage")
```

## Data Pipeline

```python
# Fabric Data Factory pipeline for scheduled ingestion
# Configure in Fabric UI:
# Source: Azure Blob Storage → Copy to Files/bronze/
# Schedule: Every 6 hours
# Notebook activity: Run bronze_to_silver notebook after copy
```

## Governance

| Control | Implementation |
|---------|---------------|
| Lineage | Fabric auto-captures in Purview |
| Access | Workspace roles (Admin, Member, Contributor, Viewer) |
| Sensitivity | Microsoft Information Protection labels |
| Retention | Delta table VACUUM + retention policies |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Slow Spark jobs | Small files problem | Optimize with OPTIMIZE + ZORDER |
| Delta table bloated | No VACUUM | Run VACUUM RETAIN 168 HOURS |
| Permission denied | Wrong workspace role | Grant Contributor for write access |
| Schema mismatch | Source schema changed | Add schema evolution handling |
