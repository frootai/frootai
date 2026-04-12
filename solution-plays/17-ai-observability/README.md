# Play 17 — AI Observability 📊

> End-to-end monitoring for AI workloads — tracing, metrics, dashboards, and intelligent alerts.

Instrument your AI pipeline with Application Insights, track token usage and cost per tenant with custom metrics, build KQL dashboards for real-time visibility, and configure alerts for latency spikes, quality drops, and budget overruns.

## Quick Start
```bash
cd solution-plays/17-ai-observability
az deployment group create -g $RG -f infra/main.bicep -p infra/parameters.json
code .  # Use @builder for instrumentation, @reviewer for telemetry audit, @tuner for cost
```

## Architecture
| Service | Purpose |
|---------|---------|
| Application Insights | Telemetry collection, distributed tracing |
| Log Analytics Workspace | KQL querying, data retention |
| Azure Monitor | Alert rules, action groups |
| Azure Dashboard | Shared workbooks with live metrics |

## AI-Specific Metrics Tracked
| Metric | Type | What It Shows |
|--------|------|-------------|
| `ai.tokens.cost` | Counter | Dollar cost per request |
| `ai.latency.ttft` | Histogram | Time to first token |
| `ai.quality.groundedness` | Gauge | RAG quality score |
| `ai.safety.blocked` | Counter | Content safety blocks |
| `ai.cache.hit` | Counter | Semantic cache effectiveness |

## DevKit (Observability-Focused)
| Primitive | What It Does |
|-----------|-------------|
| 3 agents | Builder (instrumentation/dashboards/alerts), Reviewer (telemetry audit/PII/coverage), Tuner (sampling/retention/cost) |
| 3 skills | Deploy (128 lines), Evaluate (110 lines), Tune (120 lines) |
| 4 prompts | `/deploy` (App Insights + dashboards), `/test` (tracing), `/review` (PII/retention), `/evaluate` (alert coverage) |

**Note:** This is an operational observability play. TuneKit covers sampling rates, alert thresholds, log retention tiers, KQL optimization, and Log Analytics cost — not AI model parameters.

## Cost
| Dev | Prod (10GB/day) | Optimized |
|-----|-----------------|-----------|
| $50–100/mo | ~$1,090/mo | ~$525/mo (52% savings from sampling + retention tiers) |

📖 [Full docs](spec/README.md) · 🌐 [frootai.dev/solution-plays/17-ai-observability](https://frootai.dev/solution-plays/17-ai-observability)
