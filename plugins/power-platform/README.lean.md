# power-platform

> Power Platform AI integration — Power Apps code components, Power BI DAX and modeling, Power Automate flow design, Dataverse SDK patterns, and Copilot Studio custom connectors.

## Overview

This plugin bundles **0 primitives** (0 agents, 0 instructions, 0 skills, 0 hooks) into one installable package; all primitives are WAF-aligned and FAI Protocol auto-wiring compatible.

## Installation

```bash
npx frootai install power-platform
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|

## Compatible Solution Plays

- **Play 08-copilot-studio-bot**

## Keywords

`power-platform` `power-apps` `power-bi` `power-automate` `dataverse` `copilot-studio` `pcf` `dax`

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

1. Fork the [FrootAI repository](https://github.com/FrootAI/frootai)
2. Edit files in `plugins/power-platform/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
