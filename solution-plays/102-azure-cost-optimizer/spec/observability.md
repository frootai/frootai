# Observability Contract

## Goals

Observability proves data freshness, provider behavior, deterministic correctness, agent budgets, report health, and user latency without exposing financial records.

## Correlation

Use one opaque correlation ID across HTTP request, refresh job, source adapters, snapshot revision, report, agent response, and trace. Do not derive it from tenant, subscription, resource, report contents, or user input.

## Metrics

| Metric | Dimensions |
|---|---|
| `aci_snapshot_age_seconds` | profile, source status |
| `aci_refresh_duration_ms` | source, outcome |
| `aci_refresh_requests_total` | source, HTTP class |
| `aci_refresh_coalesced_total` | profile |
| `aci_throttle_total` | source, retry form |
| `aci_cache_hit_total` | layer, outcome |
| `aci_snapshot_publish_total` | outcome |
| `aci_cosmos_request_units` | container, operation, outcome |
| `aci_cosmos_throttle_total` | container, operation |
| `aci_blob_bytes` | object class, direction |
| `aci_report_duration_ms` | format, outcome |
| `aci_report_bytes` | format |
| `aci_agent_duration_ms` | outcome |
| `aci_agent_model_calls` | model profile, outcome |
| `aci_agent_tool_calls` | tool, outcome |
| `aci_agent_tokens` | direction, model profile |
| `aci_ui_first_paint_ms` | profile, viewport class |
| `aci_ui_provider_calls` | interaction class |

High-cardinality tenant, subscription, resource, principal, prompt, report, and evidence values do not become metric dimensions.

## Traces

Trace refresh orchestration, each source dependency, normalization, snapshot publication, optimization, report generation, evidence tool calls, model calls, and authenticated downloads. Record source name, safe outcome code, counts, timing, API version, basis, completeness, and content hashes where appropriate.

Do not record authorization headers, tokens, SAS URLs, connection strings, full URLs with sensitive query strings, cost rows, resource IDs, report contents, full prompts, or full model responses.

## Logs

Use structured events and safe issue codes. User-facing errors identify the failed stage and recovery action without raw provider messages. Sample routine success logs and retain failure counters. Apply short solution retention and a reviewed ingestion cap.

## Health

- `/health/live` proves the process can respond and never calls Azure or Foundry.
- `/health/ready` reports application readiness plus data status: fresh, stale, degraded, unavailable, or refreshing.
- Dependency outages do not make liveness fail.
- A stale or degraded snapshot remains readable when authorization still passes.

## Alerts

Alert on missing validated snapshot, refresh failures, repeated throttling, snapshot age above policy, report failures, model call/token budget violations, unauthorized access spikes, and nonzero provider calls from UI interactions.

## Evaluation Linkage

Evaluation receipts store source commit, contract hash, fixture/snapshot hash, prompt hash, tool schema hash, model/deployment identity, safe trace IDs, aggregate metrics, and artifact hashes. They do not store private financial payloads.
