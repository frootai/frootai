# project-planning

> Project Planning — PRDs, epic breakdown, implementation plans, technical spikes, and rollout strategies. AI-assisted project management with architecture decision records and feature decomposition.

## Overview

This plugin bundles **16 primitives** (4 agents, 1 instructions, 8 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install project-planning
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-product-manager` | Product manager specialist |
| Agent | `frootai-prd-writer` | Prd writer specialist |
| Agent | `frootai-specification-writer` | Specification writer specialist |
| Agent | `frootai-epic-breakdown-expert` | Epic breakdown expert specialist |
| Instruction | `markdown-waf` | Markdown waf standards |
| Skill | `frootai-prd-generator` | Prd generator capability |
| Skill | `frootai-epic-breakdown-pm` | Epic breakdown pm capability |
| Skill | `frootai-epic-breakdown-arch` | Epic breakdown arch capability |
| Skill | `frootai-implementation-plan-generator` | Implementation plan generator capability |
| Skill | `frootai-specification-generator` | Specification generator capability |
| Skill | `frootai-technical-spike` | Technical spike capability |
| Skill | `frootai-rollout-plan` | Rollout plan capability |
| Skill | `frootai-feature-breakdown` | Feature breakdown capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`project-planning` `prd` `epic-breakdown` `implementation-plan` `technical-spike` `roadmap` `adr`

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
2. Edit files in `plugins/project-planning/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
