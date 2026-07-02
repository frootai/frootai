# incident-response

> Incident Response — on-call triage, KQL query generation, Azure resource diagnostics, runbook automation, and post-incident reviews. AI-assisted SRE with intelligent alerting and root cause analysis.

## Overview

This plugin bundles **10 primitives** (3 agents, 1 instructions, 2 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install incident-response
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-incident-responder` | Incident responder specialist |
| Agent | `frootai-devops-expert` | Devops expert specialist |
| Agent | `frootai-azure-monitor-expert` | Azure monitor expert specialist |
| Instruction | `opex-monitoring` | Opex monitoring standards |
| Skill | `frootai-azure-resource-health` | Azure resource health capability |
| Skill | `frootai-azure-resource-graph` | Azure resource graph capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-session-logger` | Session logger gate |

## Keywords

`incident-response` `on-call` `sre` `kql` `diagnostics` `runbook` `root-cause` `alerting`

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
2. Edit files in `plugins/incident-response/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
