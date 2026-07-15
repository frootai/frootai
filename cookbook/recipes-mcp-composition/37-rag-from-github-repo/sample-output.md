# Sample output — RAG from a GitHub Repo

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../37-rag-from-github-repo.md) for the illustrative live-run
> output (the ingestion report).

```text
# RAG from a GitHub Repo (37-rag-from-github-repo)
attached: github, markitdown, azure
tool calls: 5
github: enumerated repo files (142)
markitdown: normalized 3 non-markdown docs
azure ai search: upserted chunks (1204)
RESULT: index 'widgets-rag' ready for retrieval
RESULT: OK
```
