# Sample output — Competitor Pricing Tracker

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../38-competitor-pricing-tracker.md) for the illustrative
> live-run output (the published Notion digest).

```text
# Competitor Pricing Tracker (38-competitor-pricing-tracker)
attached: firecrawl, mongodb, notion
tool calls: 6
crawled 3 competitor pricing pages
persisted 3 pricing snapshots to MongoDB
loaded prior snapshots for diff (3 found)
published pricing digest to Notion
RESULT: pricing digest published (3 vendors, 1 price change flagged)
RESULT: OK
```
