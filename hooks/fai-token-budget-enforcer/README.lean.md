# FAI Token Budget Enforcer

> Per-model token budgets with sliding window tracking, grace periods, configurable alert thresholds, daily resets, and multi-tenant support — preventing runaway LLM spend before it happens.

## How It Works

Before each tool call, this hook reads the session's cumulative token usage and compares against the configured budget. If the budget is exceeded, a grace period allows a few extra calls before hard-blocking. Per-model overrides let you set different limits for expensive vs. cheap models.

## Event

| Field | Value |
| --- | --- |
| **Trigger** | `SessionStart` |
| **Mode** | `warn` (log overage) or `block` (exit 1) |
| **Timeout** | 5 seconds |

## Budget Strategy Guide

| Strategy | When to Use | Configuration |
|----------|-------------|---------------|
| **Session budget** | Default — cap a single conversation | `TOKEN_BUDGET=50000` |
| **Per-model budget** | Different models, different limits | `BUDGET_GPT4O=80000`, `BUDGET_O3=40000` |
| **Sliding window** | Time-based rate limiting | `BUDGET_WINDOW_MIN=60` (60-min window) |
| **Daily reset** | Fresh budget each day | `BUDGET_RESET_DAILY=true` |
| **Multi-tenant** | Shared environments | `BUDGET_TENANT_ID=team-alpha` |

## Cost Estimation by Model

| Model | Input ($/1M tokens) | Output ($/1M tokens) | ~50K token cost |
| --- | --- | --- | --- |
| **GPT-4o** | $2.50 | $10.00 | ~$0.31 |
| **GPT-4o mini** | $0.15 | $0.60 | ~$0.02 |
| **o3** | $10.00 | $40.00 | ~$1.25 |
| **o3-mini** | $1.10 | $4.40 | ~$0.14 |
| **GPT-4 Turbo** | $10.00 | $30.00 | ~$1.00 |

## Configuration

Set via environment variables in `hooks.json`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BUDGET_MODE` | `warn` | `warn` = log only, `block` = exit 1 |
| `TOKEN_BUDGET` | `50000` | Default per-session token budget |
| `TOKEN_ESTIMATE` | `1000` | Estimated tokens per tool call |
| `BUDGET_ALERT_PCT` | `80` | Percentage threshold for alert notification |
| `BUDGET_GRACE_CALLS` | `3` | Extra calls allowed after budget exceeded |
| `BUDGET_WINDOW_MIN` | `0` | Sliding window in minutes (0 = session-based) |
| `BUDGET_RESET_DAILY` | `false` | Auto-reset budget at midnight UTC |
| `BUDGET_TENANT_ID` | `default` | Multi-tenant isolation key |
| `BUDGET_GPT4O` | `80000` | Override budget for GPT-4o |
| `BUDGET_GPT4O_MINI` | `120000` | Override budget for GPT-4o mini |
| `BUDGET_O3` | `40000` | Override budget for o3 |

## Configuration Examples

**Conservative (cost-sensitive team):**
```json
{
  "env": {
    "BUDGET_MODE": "block",
    "TOKEN_BUDGET": "25000",
    "BUDGET_ALERT_PCT": "60",
    "BUDGET_GRACE_CALLS": "1"
  }
}
```

**Generous (power users, daily cap):**
```json
{
  "env": {
    "BUDGET_MODE": "warn",
    "TOKEN_BUDGET": "200000",
    "BUDGET_RESET_DAILY": "true",
    "BUDGET_GPT4O_MINI": "500000"
  }
}
```

## Dashboard Integration

Query budget usage from the session state files:

```bash
# Current session usage
cat /tmp/FAI-budget/*.usage 2>/dev/null | awk '{s+=$1} END {print s+0, "tokens total"}'

# Active sessions
ls /tmp/FAI-budget/*.usage 2>/dev/null | wc -l
```

## Alert Webhook Setup

Combine with a post-session hook to send budget alerts:

```bash
if [ "$PERCENT" -ge 90 ]; then
  curl -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"Budget alert: ${PERCENT}% used (${TENANT_ID})\"}"
fi
```

## WAF Alignment

| Pillar | How This Hook Helps |
| --- | --- |
| **Cost Optimization** | Enforces token guardrails, prevents runaway API costs |
| **Operational Excellence** | Per-tenant tracking enables team-level governance |
| **Reliability** | Grace period prevents abrupt session termination |

## Compatible Plays

- Play 01 — Enterprise RAG (per-department budgets)
- Play 17 — AI Landing Zone (budget governance)
- Play 06 — Multi-Model Gateway (per-model routing budgets)

## Installation

```bash
cp -r hooks/FAI-token-budget-enforcer .github/hooks/
```
