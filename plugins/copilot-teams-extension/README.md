# copilot-teams-extension

> Copilot for Teams Extension — declarative agents, API plugins, message extensions, and adaptive cards for Microsoft 365 Copilot. Build custom AI experiences that surface inside Teams, Outlook, and M365 apps.

## Overview

This plugin bundles **15 primitives** (4 agents, 3 instructions, 4 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install copilot-teams-extension
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-16-builder` | Play 16 builder specialist |
| Agent | `frootai-play-16-reviewer` | Play 16 reviewer specialist |
| Agent | `frootai-play-16-tuner` | Play 16 tuner specialist |
| Agent | `frootai-copilot-ecosystem-expert` | Copilot ecosystem expert specialist |
| Instruction | `play-16-copilot-teams-extension-patterns` | Play 16 copilot teams extension patterns standards |
| Instruction | `typescript-waf` | Typescript waf standards |
| Instruction | `copilot-extensibility` | O6 copilot extend standards |
| Skill | `frootai-deploy-16-copilot-teams-extension` | Deploy 16 copilot teams extension capability |
| Skill | `frootai-evaluate-16-copilot-teams-extension` | Evaluate 16 copilot teams extension capability |
| Skill | `frootai-tune-16-copilot-teams-extension` | Tune 16 copilot teams extension capability |
| Skill | `frootai-copilot-sdk-integration` | Copilot sdk integration capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |

## Compatible Solution Plays

- **Play 16-copilot-teams-extension**

## Keywords

`teams` `copilot-extension` `declarative-agent` `api-plugin` `message-extension` `adaptive-cards` `m365`

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
2. Edit files in `plugins/copilot-teams-extension/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)