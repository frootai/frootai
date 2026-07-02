# azure-infrastructure

> Azure Infrastructure — landing zones, hub-spoke networking, private endpoints, Azure Policy, RBAC, and subscription vending. Enterprise-grade Bicep IaC for AI workloads validated against all 6 WAF pillars.

## Overview

This plugin bundles **19 primitives** (5 agents, 5 instructions, 5 skills, 4 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install azure-infrastructure
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-landing-zone` | Landing zone specialist |
| Agent | `frootai-architect` | Architect specialist |
| Agent | `frootai-azure-networking-expert` | Azure networking expert specialist |
| Agent | `frootai-azure-policy-expert` | Azure policy expert specialist |
| Agent | `frootai-azure-identity-expert` | Azure identity expert specialist |
| Instruction | `bicep-waf` | Bicep waf standards |
| Instruction | `security-bicep` | Security bicep standards |
| Instruction | `bicep-code-best-practices` | Bicep code best practices standards |
| Instruction | `azure-bicep-avm` | Azure bicep avm standards |
| Instruction | `azure-front-door-waf` | Azure front door waf standards |
| Skill | `frootai-build-bicep-module` | Build bicep module capability |
| Skill | `frootai-architecture-blueprint` | Architecture blueprint capability |
| Skill | `frootai-azure-resource-visualizer` | Azure resource visualizer capability |
| Skill | `frootai-threat-model` | Threat model capability |
| Skill | `frootai-import-iac` | Import iac capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |

## Keywords

`azure` `infrastructure` `landing-zone` `bicep` `networking` `policy` `rbac` `private-endpoints` `hub-spoke`

## Usage

After installation, the primitives are available in your project:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

In a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit files in `plugins/azure-infrastructure/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
