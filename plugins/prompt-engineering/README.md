# prompt-engineering

> Prompt Engineering — chain-of-thought, few-shot, tree-of-thought, and meta-prompting patterns. Template management, dynamic prompt assembly, safety guardrails, and evaluation-driven prompt optimization.

## Overview

This plugin bundles **17 primitives** (2 agents, 3 instructions, 7 skills, 5 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install prompt-engineering
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-prompt-engineer` | Prompt engineer specialist |
| Agent | `frootai-genai-foundations-expert` | Genai foundations expert specialist |
| Instruction | `prompt-engineering` | R1 prompt patterns standards |
| Instruction | `ai-prompt-safety-waf` | Ai prompt safety waf standards |
| Instruction | `genai-foundations` | F1 genai foundations standards |
| Skill | `frootai-prompt-builder` | Prompt builder capability |
| Skill | `frootai-dynamic-prompt` | Dynamic prompt capability |
| Skill | `frootai-basic-prompt-optimization` | Basic prompt optimization capability |
| Skill | `frootai-boost-prompt` | Boost prompt capability |
| Skill | `frootai-tldr-prompt` | Tldr prompt capability |
| Skill | `frootai-finalize-agent-prompt` | Finalize agent prompt capability |
| Skill | `frootai-build-prompting-system` | Build prompting system capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-output-validator` | Output validator gate |
| Hook | `frootai-token-budget-enforcer` | Token budget enforcer gate |

## Keywords

`prompt-engineering` `chain-of-thought` `few-shot` `templates` `safety` `optimization` `meta-prompting`

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
2. Edit files in `plugins/prompt-engineering/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)