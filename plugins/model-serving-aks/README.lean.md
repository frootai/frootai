# model-serving-aks

> Model Serving on AKS — GPU-accelerated inference, autoscaling with KEDA, model versioning, A/B deployment, and canary rollouts. Deploy open-source LLMs (Phi-4, Llama, Mistral) on Azure Kubernetes Service.

## Overview

This plugin bundles **20 primitives** (6 agents, 3 instructions, 6 skills, 5 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install model-serving-aks
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-12-builder` | Play 12 builder specialist |
| Agent | `frootai-play-12-reviewer` | Play 12 reviewer specialist |
| Agent | `frootai-play-12-tuner` | Play 12 tuner specialist |
| Agent | `frootai-azure-aks-expert` | Azure aks expert specialist |
| Agent | `frootai-kubernetes-expert` | Kubernetes expert specialist |
| Agent | `frootai-ml-engineer` | Ml engineer specialist |
| Instruction | `play-12-model-serving-aks-patterns` | Play 12 model serving aks patterns standards |
| Instruction | `kubernetes-waf` | Kubernetes waf standards |
| Instruction | `docker-waf` | Docker waf standards |
| Skill | `frootai-deploy-12-model-serving-aks` | Deploy 12 model serving aks capability |
| Skill | `frootai-evaluate-12-model-serving-aks` | Evaluate 12 model serving aks capability |
| Skill | `frootai-tune-12-model-serving-aks` | Tune 12 model serving aks capability |
| Skill | `frootai-build-kubernetes-manifest` | Build kubernetes manifest capability |
| Skill | `frootai-multi-stage-docker` | Multi stage docker capability |
| Skill | `frootai-inference-optimization` | Inference optimization capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |

## Compatible Solution Plays

- **Play 12-model-serving-aks**

## Keywords

`model-serving` `aks` `kubernetes` `gpu` `keda` `inference` `llm-deployment` `canary` `autoscaling`

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
2. Edit files in `plugins/model-serving-aks/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)
