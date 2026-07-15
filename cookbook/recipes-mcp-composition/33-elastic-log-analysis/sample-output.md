# Sample output — Elastic Log Analysis

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../33-elastic-log-analysis.md) for the illustrative live-run
> output (the incident report).

```text
# Elastic Log Analysis (33-elastic-log-analysis)
attached: elastic, context7, ms-learn
tool calls: 3
elastic: 1240 hits for 504 spike
grounded root cause via context7 (ok)
remediation guidance via ms-learn (ok)
RESULT: root-cause + remediation report emitted
RESULT: OK
```
