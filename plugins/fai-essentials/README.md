# frootai-essentials

> The essential FrootAI toolkit — WAF-aligned agents (security reviewer, cost optimizer, architect), cross-cutting instructions (OWASP, agent-safety, testing), and security hooks (secrets scanner, tool guardian, governance audit). The recommended starting plugin for every FrootAI project.

## Overview

This plugin bundles **14 primitives** (5 agents, 3 instructions, 3 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install frootai-essentials
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-security-reviewer` | Security reviewer specialist |
| Agent | `frootai-cost-optimizer` | Cost optimizer specialist |
| Agent | `frootai-architect` | Architect specialist |
| Agent | `frootai-play-dispatcher` | Play dispatcher specialist |
| Agent | `frootai-play-lifecycle` | Play lifecycle specialist |
| Instruction | `security-owasp` | Security owasp standards |
| Instruction | `agent-safety` | Agent safety standards |
| Instruction | `testing-best-practices` | Testing best practices standards |
| Skill | `frootai-play-initializer` | Play initializer capability |
| Skill | `frootai-deploy-preflight` | Deploy preflight capability |
| Skill | `frootai-eval-runner` | Eval runner capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`essentials` `waf` `security` `cost` `owasp` `agent-safety` `testing` `hooks` `starter`

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
| Cost Optimization | Model routing (GPT-4o vs mini), token budgets, caching, right-sizing |
| Responsible AI | Content safety, PII redaction, bias detection, groundedness enforcement |

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
2. Edit files in `plugins/frootai-essentials/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)