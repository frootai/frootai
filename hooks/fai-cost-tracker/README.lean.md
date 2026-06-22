# FAI Cost Tracker

> Model-aware cost estimation with per-session tracking, daily/weekly/monthly aggregation, anomaly detection, CSV export, and budget alerting — FinOps visibility for AI-assisted development.

## How It Works

At session end (`Stop` event), this hook estimates token usage from the git diff, applies model-specific pricing, logs a structured cost entry, aggregates across time ranges, and flags anomalies when a session's usage is 3x higher than the rolling average.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `Stop` (VS Code April 2026 spec) |
| **Mode** | `log` (record silently) or `alert` (warn on threshold) |
| **Log file** | `logs/copilot/costs.jsonl` |
| **Timeout** | 10 seconds |

## Pricing Reference Table

| Model | Rate ($/1K tokens) | 10K tokens | 50K tokens | 100K tokens |
| --- | --- | --- | --- | --- |
| **GPT-4o** | $0.005 | $0.05 | $0.25 | $0.50 |
| **GPT-4o mini** | $0.0003 | $0.003 | $0.015 | $0.03 |
| **o3** | $0.010 | $0.10 | $0.50 | $1.00 |
| **o3-mini** | $0.0012 | $0.012 | $0.06 | $0.12 |
| **GPT-4 Turbo** | $0.010 | $0.10 | $0.50 | $1.00 |
| **text-embedding-3** | $0.0001 | $0.001 | $0.005 | $0.01 |

## Log Entry Format

```json
{
  "timestamp": "2026-04-06T10:30:00Z",
  "event": "sessionEnd",
  "session_id": "abc123",
  "model": "gpt-4o",
  "files_changed": 5,
  "lines_added": 120,
  "lines_removed": 30,
  "estimated_tokens": 600,
  "estimated_cost_usd": 0.003000,
  "mode": "log"
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `COST_MODE` | `log` | `log` = silent, `alert` = warn on threshold |
| `COST_DAILY_THRESHOLD` | `5.00` | USD threshold for daily alert |
| `COST_LOG_DIR` | `logs/copilot` | Log file directory |
| `COST_EXPORT_CSV` | `false` | Also write entries to `costs.csv` |
| `COST_MODEL` | `gpt-4o` | Model name for pricing lookup |

## Cost Optimization Strategies

| Strategy | Impact | How |
|----------|--------|-----|
| **Use GPT-4o mini** | 17x cheaper than GPT-4o | Set `COST_MODEL=gpt-4o-mini` for routine tasks |
| **Set daily alerts** | Catch runaway sessions | `COST_MODE=alert`, `COST_DAILY_THRESHOLD=2.00` |
| **Monitor anomalies** | Detect unusual spikes | Built-in — flags sessions >3x average |
| **Export CSV** | Chargeback & analysis | `COST_EXPORT_CSV=true` for spreadsheet import |
| **Review weekly** | Trend analysis | `grep "$(date -u +%Y-%m)" costs.jsonl \| jq ...` |

## Report Generation

```bash
# Daily cost report
TODAY=$(date -u +%Y-%m-%d)
grep "$TODAY" logs/copilot/costs.jsonl | \
  jq -s '{sessions: length, total_tokens: [.[].estimated_tokens] | add,
          total_cost: [.[].estimated_cost_usd] | add}'

# Weekly summary by model
grep "$(date -u +%Y)" logs/copilot/costs.jsonl | \
  jq -rs 'group_by(.model) | map({model: .[0].model,
    sessions: length, cost: [.[].estimated_cost_usd] | add})'

# Export to CSV manually
echo "timestamp,model,tokens,cost" > report.csv
jq -r '[.timestamp,.model,.estimated_tokens,.estimated_cost_usd] | @csv' \
  logs/copilot/costs.jsonl >> report.csv
```

## Integration with FinOps Tools

**Azure Cost Management:**
```bash
# Tag AI-assisted costs in Azure resource tags
az tag create --resource-id $RESOURCE_ID \
  --tags "copilot-cost=$(jq -s '[.[].estimated_cost_usd] | add' logs/copilot/costs.jsonl)"
```

**Datadog / Grafana:**
```bash
# Push metrics via StatsD
echo "copilot.daily_cost:${daily_cost}|g|#team:${TEAM}" | nc -u -w1 localhost 8125
```

## Anomaly Detection

The tracker flags sessions where estimated tokens exceed **3x the rolling average** of the last 10 sessions. This catches:
- Accidental large-context uploads
- Runaway loops in agent orchestration
- Unexpected model usage spikes

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Cost Optimization** | Per-session cost visibility, model-aware pricing, budget alerts |
| **Operational Excellence** | Aggregated reports for capacity planning and team governance |
| **Responsible AI** | Encourages mindful AI usage through consumption visibility |

## Compatible Plays

- Play 01 — Enterprise RAG (department-level cost tracking)
- Play 14 — Cost-Optimized AI Gateway (per-model cost breakdown)
- Play 17 — AI Observability (FinOps governance)

## Installation

```bash
cp -r hooks/fai-cost-tracker .github/hooks/
```
