# ai-landing-zone

> Azure AI Landing Zone: subscription vending, network topology, RBAC, policy enforcement, and hub-spoke architecture for enterprise AI workloads. Includes Bicep IaC modules validated against all 6 WAF pillars.

## Overview

This plugin bundles **17 primitives** (5 agents, 3 instructions, 5 skills, 4 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install ai-landing-zone
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-02-builder` | Play 02 builder |
| Agent | `frootai-play-02-reviewer` | Play 02 reviewer |
| Agent | `frootai-play-02-tuner` | Play 02 tuner |
| Agent | `frootai-landing-zone` | Landing zone specialist |
| Agent | `frootai-architect` | Architect specialist |
| Instruction | `play-02-ai-landing-zone-patterns` | Play 02 AI landing zone standards |
| Instruction | `bicep-waf` | Bicep WAF standards |
| Instruction | `security-bicep` | Security Bicep standards |
| Skill | `frootai-deploy-02-ai-landing-zone` | Deploy 02 AI landing zone |
| Skill | `frootai-evaluate-02-ai-landing-zone` | Evaluate 02 AI landing zone |
| Skill | `frootai-tune-02-ai-landing-zone` | Tune 02 AI landing zone |
| Skill | `frootai-build-bicep-module` | Build Bicep module |
| Skill | `frootai-architecture-blueprint` | Architecture blueprint |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | WAF compliance gate |

## Compatible Solution Plays

- **Play 02-ai-landing-zone**

## Keywords

`azure` `landing-zone` `bicep` `rbac` `policy` `hub-spoke` `enterprise` `iac` `waf-aligned`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol: shared context, WAF guardrails, and evaluation thresholds propagate automatically.

## WAF Alignment

| Pillar | Coverage |
|--------|----------|
| Security | Secrets scanning, Managed Identity, Key Vault integration, RBAC |

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
2. Edit files in `plugins/ai-landing-zone/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
