# anomaly-detection

> Anomaly Detection — real-time and batch anomaly detection for time-series, metrics, and log data using Azure AI Anomaly Detector, custom ML models, and event-driven alerting with Azure Event Hubs.

## Overview

This plugin bundles **16 primitives** (5 agents, 3 instructions, 4 skills, 4 hooks) into one installable package. All are WAF-aligned and FAI Protocol auto-wiring compatible.

## Installation

```bash
npx frootai install anomaly-detection
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-20-builder` | Play 20 builder specialist |
| Agent | `frootai-play-20-reviewer` | Play 20 reviewer specialist |
| Agent | `frootai-play-20-tuner` | Play 20 tuner specialist |
| Agent | `frootai-data-engineer` | Data engineer specialist |
| Agent | `frootai-ml-engineer` | Ml engineer specialist |
| Instruction | `play-20-anomaly-detection-patterns` | Play 20 anomaly detection patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `opex-monitoring` | Opex monitoring standards |
| Skill | `frootai-deploy-20-anomaly-detection` | Deploy 20 anomaly detection capability |
| Skill | `frootai-evaluate-20-anomaly-detection` | Evaluate 20 anomaly detection capability |
| Skill | `frootai-tune-20-anomaly-detection` | Tune 20 anomaly detection capability |
| Skill | `frootai-build-etl-pipeline` | Build etl pipeline capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-session-logger` | Session logger gate |

## Compatible Solution Plays

- **Play 20-anomaly-detection**

## Keywords

`anomaly-detection` `time-series` `metrics` `alerting` `event-hubs` `azure-ai` `real-time` `ml`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

When used inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Security | Secrets scanning, Managed Identity, Key Vault integration, RBAC |
| Reliability | Retry with backoff, circuit breaker, health probes, fallback chains |
| Operational Excellence | CI/CD integration, observability, IaC templates, automated testing |

## Quality Gates

When used inside a play, this plugin enforces:

| Metric | Threshold |
|--------|-----------|
| Groundedness | ≥ 0.85 |
| Coherence | ≥ 0.80 |
| Relevance | ≥ 0.80 |
| Safety | 0 violations |
| Cost per query | ≤ $0.05 |

## Contributing

To improve this plugin:

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/anomaly-detection/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
