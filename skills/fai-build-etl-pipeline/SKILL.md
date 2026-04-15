---
name: fai-build-etl-pipeline
description: |
  Implement ETL pipelines with idempotent loads, schema evolution handling, checkpoint
  recovery, and data quality validation. Use when building data ingestion for AI
  training sets, knowledge bases, or analytics platforms.
---

# ETL Pipeline Patterns

Build reliable extract-transform-load pipelines with idempotency, checkpointing, and validation.

## When to Use

- Ingesting data for AI training datasets or knowledge bases
- Building document processing pipelines (PDF → chunks → embeddings → index)
- Implementing incremental loads with change detection
- Setting up pipeline recovery from failures

---

## Pattern 1: Document Processing ETL

```python
from pathlib import Path
import json, hashlib

def etl_documents(source_dir: str, output_path: str, checkpoint_path: str):
    """Extract text from documents, transform to chunks, load to JSONL."""
    checkpoint = load_checkpoint(checkpoint_path)

    for doc_path in Path(source_dir).rglob("*.pdf"):
        doc_hash = hash_file(doc_path)
        if doc_hash in checkpoint:
            continue  # Skip already processed

        # Extract
        text = extract_text(doc_path)

        # Transform
        chunks = chunk_text(text, chunk_size=512, overlap=50)

        # Load
        with open(output_path, "a") as f:
            for i, chunk in enumerate(chunks):
                record = {"id": f"{doc_path.stem}-{i}", "content": chunk,
                          "source": str(doc_path), "chunk_index": i}
                f.write(json.dumps(record) + "\n")

        # Checkpoint
        checkpoint[doc_hash] = {"path": str(doc_path), "chunks": len(chunks)}
        save_checkpoint(checkpoint, checkpoint_path)

def hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]
```

## Pattern 2: Idempotent Database Load

```python
def upsert_batch(records: list[dict], table: str, merge_key: str, conn):
    """Idempotent merge — safe to re-run without duplicates."""
    cursor = conn.cursor()
    for record in records:
        cursor.execute(f"""
            MERGE INTO {table} AS target
            USING (SELECT ? AS {merge_key}) AS source
            ON target.{merge_key} = source.{merge_key}
            WHEN MATCHED THEN UPDATE SET {', '.join(f'{k}=?' for k in record if k != merge_key)}
            WHEN NOT MATCHED THEN INSERT ({', '.join(record.keys())}) VALUES ({', '.join('?' * len(record))});
        """, [record[merge_key]] + [v for k, v in record.items() if k != merge_key] + list(record.values()))
    conn.commit()
```

## Pattern 3: Incremental Load with Watermark

```python
from datetime import datetime, timezone

def incremental_load(source_query_fn, load_fn, watermark_path: str):
    """Load only records newer than last watermark."""
    last_watermark = load_watermark(watermark_path)
    new_records = source_query_fn(since=last_watermark)

    if not new_records:
        return {"status": "no_new_data", "watermark": last_watermark}

    load_fn(new_records)
    new_watermark = max(r["updated_at"] for r in new_records)
    save_watermark(new_watermark, watermark_path)

    return {"status": "loaded", "count": len(new_records), "watermark": new_watermark}
```

## Schema Evolution

```python
def handle_schema_change(record: dict, expected_fields: list[str]) -> dict:
    """Handle new/missing fields gracefully."""
    # Add missing fields with defaults
    for field in expected_fields:
        if field not in record:
            record[field] = None

    # Log unexpected new fields (don't drop — might be intentional)
    new_fields = set(record.keys()) - set(expected_fields)
    if new_fields:
        log.warning(f"New fields detected: {new_fields}")

    return record
```

## Pipeline Monitoring

```python
def track_pipeline_run(name: str, fn, **kwargs) -> dict:
    """Track ETL run metrics for observability."""
    start = time.time()
    try:
        result = fn(**kwargs)
        return {"pipeline": name, "status": "success",
                "duration_s": time.time() - start, **result}
    except Exception as e:
        return {"pipeline": name, "status": "failed",
                "duration_s": time.time() - start, "error": str(e)}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Duplicate records | Non-idempotent load | Use MERGE with unique key |
| Pipeline fails mid-batch | No checkpointing | Add per-record checkpoint, resume from last |
| Schema mismatch | Source added new columns | Handle schema evolution with defaults |
| Slow incremental loads | Full scan each run | Use watermark column with index |
