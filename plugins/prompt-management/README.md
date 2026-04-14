# prompt-management

> Prompt Management — version-controlled prompt templates, A/B testing, evaluation pipelines, and dynamic prompt assembly. Manage hundreds of prompts across models with Semantic Kernel prompt functions.

## Overview

This plugin bundles **18 primitives** (5 agents, 3 instructions, 6 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install prompt-management
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-18-builder` | Play 18 builder specialist |
| Agent | `frootai-play-18-reviewer` | Play 18 reviewer specialist |
| Agent | `frootai-play-18-tuner` | Play 18 tuner specialist |
| Agent | `frootai-prompt-engineer` | Prompt engineer specialist |
| Agent | `frootai-semantic-kernel-expert` | Semantic kernel expert specialist |
| Instruction | `play-18-prompt-management-patterns` | Play 18 prompt management patterns standards |
| Instruction | `prompt-engineering` | R1 prompt patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Skill | `frootai-deploy-18-prompt-management` | Deploy 18 prompt management capability |
| Skill | `frootai-evaluate-18-prompt-management` | Evaluate 18 prompt management capability |
| Skill | `frootai-tune-18-prompt-management` | Tune 18 prompt management capability |
| Skill | `frootai-prompt-builder` | Prompt builder capability |
| Skill | `frootai-dynamic-prompt` | Dynamic prompt capability |
| Skill | `frootai-basic-prompt-optimization` | Basic prompt optimization capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-output-validator` | Output validator gate |

## Compatible Solution Plays

- **Play 18-prompt-management**

## Keywords

`prompt-management` `prompt-engineering` `template` `ab-testing` `evaluation` `semantic-kernel` `versioning`

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
2. Edit files in `plugins/prompt-management/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)