# responsible-ai

> Responsible AI — content safety, bias testing, fairness metrics, transparency cards, and human-in-the-loop review. Build ethical AI systems aligned with Microsoft Responsible AI Standard and EU AI Act requirements.

## Overview

This plugin bundles **16 primitives** (3 agents, 4 instructions, 4 skills, 5 hooks) into a single installable package. All primitives are WAF-aligned and compatible with the FAI Protocol auto-wiring system.

## Installation

```bash
npx frootai install responsible-ai
```

Or manually copy the referenced primitives from the FrootAI repository into your project.

## What's Included

| Type | Name | Purpose |
|------|------|---------|
| Agent | `frootai-responsible-ai-reviewer` | Responsible ai reviewer specialist |
| Agent | `frootai-content-safety-expert` | Content safety expert specialist |
| Agent | `frootai-red-team-expert` | Red team expert specialist |
| Instruction | `rai-content-safety` | Rai content safety standards |
| Instruction | `rai-bias-testing` | Rai bias testing standards |
| Instruction | `responsible-ai-coding` | T2 responsible ai standards |
| Instruction | `agent-safety` | Agent safety standards |
| Skill | `frootai-content-safety-review` | Content safety review capability |
| Skill | `frootai-human-in-the-loop` | Human in the loop capability |
| Skill | `frootai-guardrails-policy` | Guardrails policy capability |
| Skill | `frootai-gdpr-compliance` | Gdpr compliance capability |
| Hook | `frootai-secrets-scanner` | Secrets scanner gate |
| Hook | `frootai-tool-guardian` | Tool guardian gate |
| Hook | `frootai-governance-audit` | Governance audit gate |
| Hook | `frootai-pii-redactor` | Pii redactor gate |
| Hook | `frootai-output-validator` | Output validator gate |

## Keywords

`responsible-ai` `content-safety` `bias` `fairness` `transparency` `human-in-the-loop` `eu-ai-act` `ethics`

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
2. Edit files in `plugins/responsible-ai/`
3. Run `npm run validate:primitives` to verify
4. Open a PR — CI validates schema and naming automatically

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for full guidelines.

## License

MIT — see [LICENSE](../../LICENSE)