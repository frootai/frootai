# Sample output — Multi-Cloud Cost Report

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../31-multi-cloud-cost-report.md) for the illustrative live-run
> output (the cross-period cost report).

```text
# Multi-Cloud Cost Report (31-multi-cloud-cost-report)
attached: azure, mongodb
tool calls: 2
live spend fetched (ok); history aggregated (ok)
Azure OpenAI: $4100 (38% vs trailing mean) ⚠️ anomaly
Storage: $2030 (-4% vs trailing mean)
RESULT: 1 anomaly(ies) flagged
RESULT: OK
```
