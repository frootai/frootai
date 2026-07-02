# cost-optimized-ai-gateway

> Cost-Optimized AI Gateway — intelligent model routing, token budget enforcement, request caching, rate limiting, and usage analytics. Route between GPT-4o, GPT-4o-mini, and Phi models based on complexity and cost.

## Overview

This plugin bundles **20 primitives** (6 agents, 3 instructions, 6 skills, 5 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install cost-optimized-ai-gateway
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-14-builder` | Play 14 builder specialist |
| Agent | `frootai-play-14-reviewer` | Play 14 reviewer specialist |
| Agent | `frootai-play-14-tuner` | Play 14 tuner specialist |
| Agent | `frootai-cost-optimizer` | Cost optimizer specialist |
| Agent | `frootai-cost-gateway` | Cost gateway specialist |
| Agent | `frootai-azure-apim-expert` | Azure apim expert specialist |
| Instruction | `play-14-cost-optimized-ai-gateway-patterns` | Play 14 cost optimized ai gateway patterns standards |
| Instruction | `cost-python` | Cost python standards |
| Instruction | `cost-typescript` | Cost typescript standards |
| Skill | `frootai-deploy-14-cost-optimized-ai-gateway` | Deploy 14 cost optimized ai gateway capability |
| Skill | `frootai-evaluate-14-cost-optimized-ai-gateway` | Evaluate 14 cost optimized ai gateway capability |
| Skill | `frootai-tune-14-cost-optimized-ai-gateway` | Tune 14 cost optimized ai gateway capability |
| Skill | `frootai-cost-estimator` | Cost estimator capability |
| Skill | `frootai-az-cost-optimize` | Az cost optimize capability |
| Skill | `frootai-model-recommendation` | Model recommendation capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |

## Compatible Solution Plays

- **Play 14-cost-optimized-ai-gateway**

## Keywords

`cost-optimization` `ai-gateway` `model-routing` `token-budget` `caching` `rate-limiting` `apim` `usage-analytics`

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
| Cost Optimization | Model routing (GPT-4o vs mini), token budgets, caching, right-sizing |

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
2. Edit files in `plugins/cost-optimized-ai-gateway/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
