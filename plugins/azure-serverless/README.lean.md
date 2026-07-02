# azure-serverless

> Azure Serverless — Functions, Logic Apps, Event Grid, and Durable Functions patterns. Event-driven architectures with consumption-based scaling, cold start mitigation, and cost optimization.

## Overview

This plugin bundles **11 primitives** (3 agents, 2 instructions, 2 skills, 4 hooks) into one installable package; all are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-serverless
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-azure-functions-expert` | Azure functions expert specialist |
| Agent | `frootai-azure-logic-apps-expert` | Azure logic apps expert specialist |
| Agent | `frootai-event-driven-expert` | Event driven expert specialist |
| Instruction | `azure-functions-waf` | Azure functions waf standards |
| Instruction | `azure-logic-apps-waf` | Azure logic apps waf standards |
| Skill | `frootai-azure-functions-setup` | Azure functions setup capability |
| Skill | `frootai-azure-event-grid-setup` | Azure event grid setup capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Keywords

`azure` `serverless` `functions` `logic-apps` `event-grid` `durable-functions` `event-driven` `consumption`

## Usage

After installation, primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-serverless/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
