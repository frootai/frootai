# code-quality

> Code Quality — automated code review, refactoring suggestions, dead code removal, complexity analysis, and technical debt tracking. AI-powered quality gates with custom rulesets and team coding standards.

## Overview

This plugin bundles **17 primitives** (3 agents, 4 instructions, 6 skills, 4 hooks) into one installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install code-quality
```

Or copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-code-reviewer` | Code reviewer |
| Agent | `frootai-refactoring-expert` | Refactoring expert |
| Agent | `frootai-tech-debt-analyst` | Tech debt analyst |
| Instruction | `code-review-waf` | Code review standards |
| Instruction | `design-patterns-waf` | Design pattern standards |
| Instruction | `object-calisthenics-waf` | Object calisthenics standards |
| Instruction | `self-documenting-code-waf` | Self-documenting code standards |
| Skill | `frootai-code-smell-detector` | Code smell detection |
| Skill | `frootai-dead-code-removal` | Dead code removal |
| Skill | `frootai-refactor-complexity` | Complexity refactoring |
| Skill | `frootai-refactor-plan` | Refactor planning |
| Skill | `frootai-refactor-skill` | Refactoring |
| Skill | `frootai-review-and-refactor` | Review and refactor |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-waf-compliance` | Waf compliance gate |

## Keywords

`code-quality` `code-review` `refactoring` `dead-code` `complexity` `tech-debt` `linting`

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
2. Edit files in `plugins/code-quality/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
