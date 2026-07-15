# Sample output — Azure Resource Audit

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../29-azure-resource-audit.md) for the illustrative live-run
> output (the per-resource audit table).

```text
# Azure Resource Audit (29-azure-resource-audit)
attached: azure, ms-learn
tool calls: 4
kv-acme-prod (Key Vault): pass [doc fetched]
st-acme-logs (Storage): gap [doc fetched]
app-acme-api (App Service): pass [doc fetched]
RESULT: 1 gap(s) across 3 resources
RESULT: OK
```
