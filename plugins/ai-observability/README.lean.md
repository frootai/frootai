# ai-observability

> AI Observability: distributed tracing for LLM calls, token-usage dashboards, latency monitoring, evaluation score tracking, and alerting. Full AI workload observability with Azure Monitor and OpenTelemetry.

## Overview

This plugin bundles **17 primitives** (5 agents, 3 instructions, 4 skills, 5 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install ai-observability
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-17-builder` | Play 17 builder specialist |
| Agent | `frootai-play-17-reviewer` | Play 17 reviewer specialist |
| Agent | `frootai-play-17-tuner` | Play 17 tuner specialist |
| Agent | `frootai-azure-monitor-expert` | Azure monitor expert specialist |
| Agent | `frootai-performance-profiler` | Performance profiler specialist |
| Instruction | `play-17-ai-observability-patterns` | Play 17 ai observability patterns standards |
| Instruction | `opex-monitoring` | Opex monitoring standards |
| Instruction | `python-waf` | Python waf standards |
| Skill | `frootai-deploy-17-ai-observability` | Deploy 17 ai observability capability |
| Skill | `frootai-evaluate-17-ai-observability` | Evaluate 17 ai observability capability |
| Skill | `frootai-tune-17-ai-observability` | Tune 17 ai observability capability |
| Skill | `frootai-copilot-usage-metrics` | Copilot usage metrics capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-session-logger` | Session logger gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Compatible Solution Plays

- **Play 17-ai-observability**

## Keywords

`observability` `monitoring` `tracing` `opentelemetry` `azure-monitor` `token-usage` `latency` `dashboards`

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
2. Edit files in `plugins/ai-observability/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
