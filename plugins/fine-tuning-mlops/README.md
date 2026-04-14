# fine-tuning-mlops

> Fine-Tuning & MLOps — dataset curation, model training, hyperparameter optimization, model registry, and deployment pipelines. End-to-end ML lifecycle with Azure AI Foundry, MLflow, and evaluation gates.

## Overview

This plugin bundles **14 primitives** (3 agents, 2 instructions, 5 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install fine-tuning-mlops
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-fine-tuning-expert` | Fine tuning expert specialist |
| Agent | `frootai-ml-engineer` | Ml engineer specialist |
| Agent | `frootai-data-engineer` | Data engineer specialist |
| Instruction | `fine-tuning-data` | T1 fine tuning data standards |
| Instruction | `python-waf` | Python waf standards |
| Skill | `frootai-fine-tune-llm` | Fine tune llm capability |
| Skill | `frootai-build-llm-evaluator` | Build llm evaluator capability |
| Skill | `frootai-model-recommendation` | Model recommendation capability |
| Skill | `frootai-inference-optimization` | Inference optimization capability |
| Skill | `frootai-build-tokenizer` | Build tokenizer capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Keywords

`fine-tuning` `mlops` `model-training` `dataset` `hyperparameter` `mlflow` `model-registry` `azure-ai-foundry`

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
2. Edit files in `plugins/fine-tuning-mlops/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)