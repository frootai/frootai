# Sample output — pgEdge Replication Monitor

> Captured from `node run.mjs` (offline harness — fake areas, no network or
> secrets). Reproducible on a fresh CI runner. See
> [the recipe](../../35-pgedge-replication-monitor.md) for the illustrative
> live-run output (the per-node health report).

```text
# pgEdge Replication Monitor (35-pgedge-replication-monitor)
attached: pgedge, elastic
tool calls: 2
pgedge: replication state read (3 nodes)
n1: lag 0s ok
n2: lag 0.4s ok
n3: lag 42s ⚠️ lagging (log-correlated)
RESULT: 1 node(s) flagged
RESULT: OK
```
