# azure-monitoring

> Azure Monitoring — Application Insights, Log Analytics, KQL queries, alert rules, workbooks, and dashboards. Full observability for AI workloads with custom metrics, distributed tracing, and SLO tracking.

## Overview

Bundles **11 primitives** (3 agents, 2 instructions, 2 skills, 4 hooks) in one installable package; all are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-monitoring
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-monitor-expert` | Azure monitor expert specialist |
| Agent | `frootai-performance-profiler` | Performance profiler specialist |
| Agent | `frootai-incident-responder` | Incident responder specialist |
| Instruction | `opex-monitoring` | Opex monitoring standards |
| Instruction | `performance-optimization-waf` | Performance optimization waf standards |
| Skill | `frootai-copilot-usage-metrics` | Copilot usage metrics capability |
| Skill | `frootai-azure-resource-health` | Azure resource health capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-session-logger` | Session logger gate |

## Keywords

`azure` `monitoring` `application-insights` `log-analytics` `kql` `alerts` `dashboards` `observability`

## Usage

After installation:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

In a solution play with `fai-manifest.json`, primitives auto-wire through the FAI Protocol; shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-monitoring/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
