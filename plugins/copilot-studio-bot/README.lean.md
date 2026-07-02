# copilot-studio-bot

> Copilot Studio Bot — custom copilot experiences with Microsoft Copilot Studio, Power Virtual Agents, and Teams integration. Build conversational AI with enterprise SSO, Dataverse, and multi-channel deployment.

## Overview

This plugin bundles **17 primitives** (5 agents, 3 instructions, 5 skills, 4 hooks) into one installable package; all are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install copilot-studio-bot
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-08-builder` | Play 08 builder |
| Agent | `frootai-play-08-reviewer` | Play 08 reviewer |
| Agent | `frootai-play-08-tuner` | Play 08 tuner |
| Agent | `frootai-power-platform-expert` | Power platform expert |
| Agent | `frootai-copilot-ecosystem-expert` | Copilot ecosystem expert |
| Instruction | `play-08-copilot-studio-bot-patterns` | Play 08 copilot studio bot patterns |
| Instruction | `copilot-studio-waf` | Copilot studio waf standards |
| Instruction | `dataverse-waf` | Dataverse waf standards |
| Skill | `frootai-deploy-08-copilot-studio-bot` | Deploy 08 copilot studio bot |
| Skill | `frootai-evaluate-08-copilot-studio-bot` | Evaluate 08 copilot studio bot |
| Skill | `frootai-tune-08-copilot-studio-bot` | Tune 08 copilot studio bot |
| Skill | `frootai-copilot-sdk-integration` | Copilot sdk integration |
| Skill | `frootai-power-platform-connector` | Power platform connector |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |

## Compatible Solution Plays

- **Play 08-copilot-studio-bot**

## Keywords

`copilot-studio` `power-virtual-agents` `teams` `dataverse` `conversational-ai` `sso` `enterprise`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol, propagating shared context, WAF guardrails, and evaluation thresholds.

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
2. Edit files in `plugins/copilot-studio-bot/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
