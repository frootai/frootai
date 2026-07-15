# Sample output — Vector DB Comparison

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../34-vector-db-comparison.md) for the illustrative live-run
> output (the recall/latency/cost bake-off table).

```text
# Vector DB Comparison (34-vector-db-comparison)
attached: qdrant, chromadb, pinecone
tool calls: 6
qdrant: indexed + queried → recall@10 0.94
chromadb: indexed + queried → recall@10 0.91
pinecone: indexed + queried → recall@10 0.95
RESULT: bake-off complete — top recall: pinecone
RESULT: OK
```
