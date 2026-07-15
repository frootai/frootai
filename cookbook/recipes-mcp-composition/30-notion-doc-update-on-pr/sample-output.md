# Sample output — Notion Doc Update on PR

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../30-notion-doc-update-on-pr.md) for the illustrative live-run
> output (the doc-sync run report).

```text
# Notion Doc Update on PR (30-notion-doc-update-on-pr)
attached: github, notion, stripe
tool calls: 4
PR #318 merged: 2 changed docs
mirrored docs/pricing.md → Notion
stripe reconciled: Pro price → $39 (test mode)
mirrored docs/faq.md → Notion
RESULT: OK
```
