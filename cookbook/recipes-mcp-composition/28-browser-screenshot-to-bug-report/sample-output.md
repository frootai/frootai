# Sample output — Browser Screenshot to Bug Report

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../28-browser-screenshot-to-bug-report.md) for the illustrative
> live-run output (the filed GitHub issue).

```text
# Browser Screenshot to Bug Report (28-browser-screenshot-to-bug-report)
attached: playwright, markitdown, github
tool calls: 5
captured https://example.test/cart: screenshot + DOM snapshot + console
summarized failure via markitdown (object)
opened issue: #482
RESULT: OK
```
