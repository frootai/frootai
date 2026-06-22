# Foundry Agent Observability

> **[M8.25]** Dashboard links + event schema for the FrootAI Foundry hosted agent. Linked from the [FrootAI Status page](https://status.frootai.dev).

## What we observe

The hosted Foundry prompt agent (`frootai-enterprise-rag` in the `swedencentral` project) emits two structured JSONL events per session to its stdout, which the Foundry runtime forwards to Application Insights:

| Event | Emitted at | Carries |
|-------|-----------|---------|
| `foundry_session_started` | Session entry, after `start_session()` | `active_play`, `attached_areas[]`, `failed_areas[]`, `tool_count` |
| `foundry_session_completed` | Session exit, before `detach_all()` | `attached_areas[]`, `tool_count` (= total federated invocations) |

Event schema authority: [`schemas/foundry-session-result.schema.json`](https://github.com/frootai/frootai-core/blob/main/schemas/foundry-session-result.schema.json) (M8.19).

## Dashboard surfaces

| Surface | URL | What it shows |
|---------|-----|---------------|
| **Status page health check** | <https://status.frootai.dev> | Foundry Agent endpoint reachability (5-min cadence) |
| **App Insights — sessions** | `https://portal.azure.com/#blade/AppInsightsExtension/.../<resource>/customEvents` | Raw `foundry_session_*` events; filter on `customDimensions.event` |
| **App Insights — Plays attach correlation** | `traces | where message contains "foundry_session_started" | summarize count() by tostring(customDimensions.active_play)` | Per-Play attach volume |
| **App Insights — federation failure rate** | `traces | where message contains "foundry_session_started" | extend failed = todynamic(tostring(customDimensions.failed_areas)) | summarize failed_total = sumif(array_length(failed), array_length(failed) > 0) by bin(timestamp, 1h)` | Per-area attach failure rate |

The portal URLs above use `<resource>` as a placeholder — the actual subscription + resource group are resolved from `.frootai/foundry-config.json` (M8.18) at deploy time.

## KQL recipes

### Per-play session count (last 24h)

```kusto
customEvents
| where timestamp > ago(24h)
| where name == "foundry_session_started"
| extend play = tostring(customDimensions.active_play)
| summarize sessions = count() by play
| order by sessions desc
```

### Top federated tools by invocation (last 7d)

```kusto
customEvents
| where timestamp > ago(7d)
| where name == "foundry_session_completed"
| extend total = toint(customDimensions.tool_count)
| extend play  = tostring(customDimensions.active_play)
| summarize total_invocations = sum(total) by play
| order by total_invocations desc
```

### Cold-start budget breaches (M8.17)

```kusto
traces
| where timestamp > ago(24h)
| where message startswith "[federation_client] session start: cold-start"
| extend ms = todouble(extract(@"cold-start ([\d\.]+)ms", 1, message))
| where ms > 20000
| project timestamp, ms, cloud_RoleInstance
```

## Linking from the static status page

The Upptime-generated status page renders `status.frootai.dev`. To surface Foundry session metrics there, the front-end template (Upptime fork or the next/registry-site build) reads this file's "Dashboard surfaces" table and renders the URLs as link tiles below the up/down board.

Until the front-end wires that up, the link is exposed via the [`Foundry Agent — frootai-enterprise-rag`](https://status.frootai.dev) tile on the status page: clicking it opens the agent health endpoint + a "View session telemetry →" link to this file.

## Related

- [foundry-agent README](https://github.com/frootai/frootai-core/blob/main/foundry-agent/README.md) — env-var matrix + sample play scope (M8.20)
- [agent.yaml](https://github.com/frootai/frootai-core/blob/main/foundry-agent/.foundry/agent.yaml) — deployment manifest with telemetry config (M8.10)
- [foundry-session-result.schema.json](https://github.com/frootai/frootai-core/blob/main/schemas/foundry-session-result.schema.json) — event payload schema (M8.19)
- [emit_session_event](https://github.com/frootai/frootai-core/blob/main/foundry-agent/federation_client.py) — event emitter (M8.14)
