# fine-tuning-workflow

> Fine-Tuning Workflow — dataset preparation, training job orchestration, evaluation pipelines, model registry, and deployment automation. Fine-tune GPT, Phi, and open-source models on Azure AI Foundry.

## Overview

This plugin bundles **17 primitives** (5 agents, 3 instructions, 5 skills, 4 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install fine-tuning-workflow
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-play-13-builder` | Play 13 builder specialist |
| Agent | `frootai-play-13-reviewer` | Play 13 reviewer specialist |
| Agent | `frootai-play-13-tuner` | Play 13 tuner specialist |
| Agent | `frootai-fine-tuning-expert` | Fine tuning expert specialist |
| Agent | `frootai-ml-engineer` | Ml engineer specialist |
| Instruction | `play-13-fine-tuning-workflow-patterns` | Play 13 fine tuning workflow patterns standards |
| Instruction | `python-waf` | Python waf standards |
| Instruction | `fine-tuning-data` | T1 fine tuning data standards |
| Skill | `frootai-deploy-13-fine-tuning-workflow` | Deploy 13 fine tuning workflow capability |
| Skill | `frootai-evaluate-13-fine-tuning-workflow` | Evaluate 13 fine tuning workflow capability |
| Skill | `frootai-tune-13-fine-tuning-workflow` | Tune 13 fine tuning workflow capability |
| Skill | `frootai-fine-tune-llm` | Fine tune llm capability |
| Skill | `frootai-build-llm-evaluator` | Build llm evaluator capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-cost-tracker` | Cost tracker gate |

## Compatible Solution Plays

- **Play 13-fine-tuning-workflow**

## Keywords

`fine-tuning` `mlops` `dataset-preparation` `model-registry` `azure-ai-foundry` `evaluation` `training`

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
2. Edit files in `plugins/fine-tuning-workflow/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)