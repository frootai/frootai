# FrootAI Eval Datasets

MIT-licensed eval datasets for all 101 solution plays.

- **Schema:** [`eval-dataset.schema.json`](../../frootai-blueprint/schemas/eval-dataset.schema.json)
- **Format:** JSONL (one JSON object per line)
- **Minimum:** 20 cases per play
- **Top-20 plays:** 2 datasets each (base + rotating quarterly)
- **Maintainer:** every case credits its author in the `maintainer` field

## Regenerate

```bash
node frootai-blueprint/scripts/generate-eval-datasets.cjs
```

## License

MIT — see [LICENSE](../../LICENSE)