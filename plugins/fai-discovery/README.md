# frootai-discovery

> FrootAI Discovery — meta-plugin for exploring and recommending agents, instructions, skills, hooks, and plugins. Suggests the right primitives for your task based on project context and WAF alignment.

## Overview

This plugin bundles **13 primitives** (2 agents, 2 instructions, 6 skills, 3 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install frootai-discovery
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-dispatcher` | Play dispatcher specialist |
| Agent | `frootai-play-lifecycle` | Play lifecycle specialist |
| Instruction | `context-engineering-waf` | Context engineering waf standards |
| Instruction | `taming-copilot-waf` | Taming copilot waf standards |
| Skill | `frootai-suggest-agents` | Suggest agents capability |
| Skill | `frootai-suggest-instructions` | Suggest instructions capability |
| Skill | `frootai-suggest-skills` | Suggest skills capability |
| Skill | `frootai-what-context-needed` | What context needed capability |
| Skill | `frootai-first-ask` | First ask capability |
| Skill | `frootai-copilot-instructions-generator` | Copilot instructions generator capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |

## Keywords

`discovery` `meta` `recommendation` `suggest` `explore` `catalog` `primitives` `marketplace`

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
2. Edit files in `plugins/frootai-discovery/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)