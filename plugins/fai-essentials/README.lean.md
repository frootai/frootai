# frootai-essentials

> Essential FrootAI toolkit: WAF-aligned agents (security reviewer, cost optimizer, architect), cross-cutting instructions (OWASP, agent-safety, testing), and security hooks (secrets scanner, tool guardian, governance audit). Recommended starting plugin for every FrootAI project.

## Overview

This plugin bundles **14 primitives** (5 agents, 3 instructions, 3 skills, 3 hooks) in one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install frootai-essentials
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-security-reviewer` | Security reviewer |
| Agent | `frootai-cost-optimizer` | Cost optimizer |
| Agent | `frootai-architect` | Architect |
| Agent | `frootai-play-dispatcher` | Play dispatcher |
| Agent | `frootai-play-lifecycle` | Play lifecycle |
| Instruction | `security-owasp` | Security OWASP standards |
| Instruction | `agent-safety` | Agent safety standards |
| Instruction | `testing-best-practices` | Testing best practices |
| Skill | `frootai-play-initializer` | Play initializer |
| Skill | `frootai-deploy-preflight` | Deploy preflight |
| Skill | `frootai-eval-runner` | Eval runner |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`essentials` `waf` `security` `cost` `owasp` `agent-safety` `testing` `hooks` `starter`

## Usage

After installation:

1. **Agents** activate when you `@mention` them in Copilot Chat
2. **Instructions** auto-apply to matching files via `applyTo` glob patterns
3. **Skills** are invoked by agents or via `/skill` commands
4. **Hooks** fire automatically at session lifecycle events

Inside a solution play with `fai-manifest.json`, all primitives auto-wire through the FAI Protocol — shared context, WAF guardrails, and evaluation thresholds propagate automatically.

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
2. Edit `plugins/frootai-essentials/`
3. Run `npm run validate:primitives`
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
