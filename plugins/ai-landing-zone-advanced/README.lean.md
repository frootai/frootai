# ai-landing-zone-advanced

> Advanced AI Landing Zone: multi-region deployment, private endpoints, Azure Firewall, DDoS protection, sovereign cloud patterns, and compliance-ready infrastructure for regulated industries.

## Overview

This plugin bundles **20 primitives** (6 agents, 4 instructions, 5 skills, 5 hooks) in one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install ai-landing-zone-advanced
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-11-builder` | Play 11 builder specialist |
| Agent | `frootai-play-11-reviewer` | Play 11 reviewer specialist |
| Agent | `frootai-play-11-tuner` | Play 11 tuner specialist |
| Agent | `frootai-landing-zone` | Landing zone specialist |
| Agent | `frootai-azure-networking-expert` | Azure networking expert specialist |
| Agent | `frootai-compliance-expert` | Compliance expert specialist |
| Instruction | `play-11-ai-landing-zone-advanced-patterns` | Play 11 ai landing zone advanced patterns standards |
| Instruction | `bicep-waf` | Bicep waf standards |
| Instruction | `security-bicep` | Security bicep standards |
| Instruction | `azure-front-door-waf` | Azure front door waf standards |
| Skill | `frootai-deploy-11-ai-landing-zone-advanced` | Deploy 11 ai landing zone advanced capability |
| Skill | `frootai-evaluate-11-ai-landing-zone-advanced` | Evaluate 11 ai landing zone advanced capability |
| Skill | `frootai-tune-11-ai-landing-zone-advanced` | Tune 11 ai landing zone advanced capability |
| Skill | `frootai-build-bicep-module` | Build bicep module capability |
| Skill | `frootai-threat-model` | Threat model capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Compatible Solution Plays

- **Play 11-ai-landing-zone-advanced**

## Keywords

`landing-zone` `multi-region` `private-endpoints` `firewall` `compliance` `sovereign-cloud` `regulated` `enterprise`

## Usage

After installation:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol: shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/ai-landing-zone-advanced/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
